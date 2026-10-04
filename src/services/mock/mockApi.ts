import { computeCutoff, sum } from '@/lib/payroll'
import { emptyPunches, manilaToday, punchError } from '@/lib/timeRecords'
import type {
  ApayApi,
  AttendanceInput,
  AttendanceRow,
  AzoneRequest,
  DailyRow,
  Employee,
  PayrollLine,
  PayrollPeriod,
  PeriodStatus,
  Punches,
} from '../types'
import * as db from './data'

/** In-memory stand-in for aznar-api so APAY works before the backend exists. */

const wait = <T>(value: T, ms = 300): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))

class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

const lines = new Map<string, PayrollLine[]>()

/** Daily punches HR entered, keyed `${date}|${employeeId}`. (The mock's cut-off totals stay seeded; the real API derives them from these.) */
const timeRecords = new Map<string, Punches & { source: 'manual' | 'upload' }>()
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

function hoursOf(p: Punches) {
  if (!p.timeIn || !p.timeOut) return 0
  const span = (toMin(p.timeOut) - toMin(p.timeIn) + 1440) % 1440
  const brk = p.breakOut && p.breakIn ? (toMin(p.breakIn) - toMin(p.breakOut) + 1440) % 1440 : 60
  return Math.max(0, Math.round(((span - brk) / 60) * 10) / 10)
}
let actor = 'Demo User'

function findPeriod(id: string) {
  const p = db.periods.find((x) => x.id === id)
  if (!p) throw new ApiError('Payroll period not found', 404)
  return p
}

/** HR-entered cut-off attendance, keyed `${periodId}|${employeeId}`; wins over the seeded DTR summary. */
const overrides = new Map<string, AttendanceInput & { source: 'manual' | 'upload' }>()

function attendanceFor(period: PayrollPeriod): AttendanceRow[] {
  return db.buildAttendance(period).map((a) => {
    const o = overrides.get(`${period.id}|${a.employeeId}`)
    return o ? { ...a, ...o, employeeId: a.employeeId } : a
  })
}

/** Same rule as the API: only draft/computed accept edits, and a computed payroll drops back to draft. */
function reopenForAttendance(periodId: string) {
  const p = findPeriod(periodId)
  if (p.status !== 'draft' && p.status !== 'computed') throw new ApiError(`Attendance of a ${p.status} payroll can no longer be changed`, 409)
  if (p.status === 'computed') {
    lines.delete(p.id)
    applyTotals(p, [])
    p.status = 'draft'
    p.computedAt = undefined
  }
  return p
}

function computeLines(period: PayrollPeriod): PayrollLine[] {
  const attendance = attendanceFor(period)
  return attendance.map((a) => {
    const emp = db.employees.find((e) => e.id === a.employeeId)!
    const mine = db.adjustments.filter((x) => x.employeeId === emp.id && x.active)
    const amountOf = (cat: string, kind: string) => sum(mine.filter((x) => x.category === cat && x.kind === kind).map((x) => x.amount))
    const result = computeCutoff({
      monthlyBasic: emp.monthlyBasic,
      deMinimis: amountOf('de_minimis', 'allowance'),
      taxableAllowances: amountOf('taxable', 'allowance'),
      absentDays: a.absentDays,
      unpaidLeaveDays: a.unpaidLeaveDays,
      lateMinutes: Math.max(0, a.lateMinutes - db.settings.graceMinutes),
      overtime: a.overtimeHours ? [{ kind: 'regular', hours: a.overtimeHours }] : [],
      otherDeductions: mine.filter((x) => x.kind === 'deduction').map((x) => ({ label: x.name, amount: x.amount })),
    })
    return {
      ...result,
      employeeId: emp.id,
      employeeNo: emp.employeeNo,
      name: emp.fullName,
      department: emp.department,
      monthlyBasic: emp.monthlyBasic,
    }
  })
}

function applyTotals(period: PayrollPeriod, rows: PayrollLine[]) {
  period.headcount = rows.length
  period.gross = sum(rows.map((r) => r.grossPay))
  period.deductions = sum(rows.map((r) => r.totalDeductions))
  period.net = sum(rows.map((r) => r.netPay))
  period.employerContributions = sum(rows.flatMap((r) => [r.employer.sss, r.employer.philhealth, r.employer.pagibig]))
}

// Released history is already computed
for (const p of db.periods.filter((p) => p.status !== 'draft')) {
  const rows = computeLines(p)
  lines.set(p.id, rows)
  applyTotals(p, rows)
}

function log(action: string, target: string) {
  db.audit.unshift({ id: `au_${Date.now()}`, at: new Date().toISOString(), actor, action, target })
}

const nextStatus: Record<PeriodStatus, PeriodStatus | null> = {
  draft: 'computed',
  computed: 'review',
  review: 'approved',
  approved: 'released',
  released: null,
}

export const mockApi: ApayApi = {
  requestPasswordReset: () => wait(undefined, 700),
  async resetPassword(token, password) {
    if (token.length < 20) throw new ApiError('This reset link is invalid or has expired. Request a new one.')
    if (password.length < 8) throw new ApiError('Use at least 8 characters')
    return wait(undefined, 600)
  },

  async login(email) {
    actor = 'Ana Cruz'
    return wait({ token: `mock.${btoa(email)}`, user: { id: 'usr_hr', name: 'Ana Cruz', email, role: 'hr', title: 'HR Manager' } }, 600)
  },

  listEmployees: () => wait(db.employees.map((e) => ({ ...e, avatarVersion: demoPhoto(e.id) ? '2026-10-01T00:00:00.000Z' : null }))),
  async getEmployee(id) {
    const e = db.employees.find((x) => x.id === id)
    if (!e) throw new ApiError('Employee not found', 404)
    // Demo stand-ins for what the employee would keep up to date in AZONE (no photos in demo mode)
    const n = Number(e.employeeNo.replace(/\D/g, '').slice(-3)) || 1
    return wait({
      ...e,
      phone: `0917 ${String(100 + (n % 900)).padStart(3, '0')} ${String(1000 + n).slice(-4)}`,
      address: `${(n % 90) + 10} Osmeña Blvd, Cebu City`,
      birthday: `199${n % 10}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 27) + 1).padStart(2, '0')}`,
      manager: e.department === 'HR Department' ? 'Ana Cruz' : 'Maria Santos',
      workSchedule: 'Mon–Fri · 8:00 AM – 5:00 PM',
      emergencyContact: {
        name: `${e.firstName === 'Rosa' ? 'Jose' : 'Rosa'} ${e.lastName}`,
        relation: 'Parent',
        phone: `0918 ${String(200 + (n % 700))} ${String(5000 + n).slice(-4)}`,
      },
      avatarUrl: demoPhoto(e.id),
    })
  },
  getEmployeeAvatar: async (id) => wait({ dataUrl: demoPhoto(id) }, 150),
  async createEmployee(input) {
    const email = input.email.toLowerCase()
    if (db.employees.some((x) => x.employeeNo === input.employeeNo)) throw new ApiError(`Employee No. ${input.employeeNo} is already used`, 409)
    if (db.employees.some((x) => x.email.toLowerCase() === email))
      throw new ApiError(`An account with ${email} already exists — use a different work email`, 409)
    const created: Employee = { ...input, email, id: `emp_${Date.now()}`, fullName: `${input.firstName} ${input.lastName}` }
    db.employees.push(created)
    log('Added employee and AZONE account', created.fullName)
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const temporaryPassword = Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => alphabet[n % alphabet.length]).join('')
    return wait({ employee: created, account: { email, temporaryPassword } }, 700)
  },

  async saveEmployee(input) {
    const fullName = `${input.firstName} ${input.lastName}`
    const e = db.employees.find((x) => x.id === input.id)
    if (!e) throw new ApiError('Employee not found', 404)
    Object.assign(e, input, { fullName })
    log('Updated employee', fullName)
    return wait(e, 500)
  },

  listPeriods: () => wait(db.periods),
  getPeriod: async (id) => wait(findPeriod(id)),
  getAttendance: async (periodId) => wait(attendanceFor(findPeriod(periodId))),

  async saveAttendance(periodId, source, rows) {
    const p = reopenForAttendance(periodId)
    const current = new Map(attendanceFor(p).map((r) => [r.employeeId, r]))
    for (const r of rows) {
      const cur = current.get(r.employeeId)
      if (!cur) throw new ApiError('Unknown or inactive employee')
      if (r.daysPresent + r.absentDays + r.paidLeaveDays + r.unpaidLeaveDays !== cur.workingDays)
        throw new ApiError(`${cur.name}: present + absent + leave must equal ${cur.workingDays} working days`)
    }
    for (const r of rows) overrides.set(`${p.id}|${r.employeeId}`, { ...r, source })
    log(
      source === 'upload' ? 'Uploaded attendance' : 'Edited attendance',
      source === 'upload' ? `${p.label} · ${rows.length} employees` : `${p.label} · ${current.get(rows[0].employeeId)!.name}`,
    )
    return wait(attendanceFor(p), 500)
  },

  async resetAttendance(periodId, employeeId) {
    const p = reopenForAttendance(periodId)
    if (!overrides.delete(`${p.id}|${employeeId}`)) throw new ApiError('Attendance override not found', 404)
    log('Reset attendance to DTR', p.label)
    return wait(attendanceFor(p), 400)
  },
  async getDailyAttendance(date) {
    const p = db.periods.find((x) => x.start <= date && date <= x.end) ?? null
    const day = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekend = day === 0 || day === 6
    const today = manilaToday()
    return wait({
      date,
      holiday: false,
      weekend,
      shift: { timeIn: '08:00', breakOut: '12:00', breakIn: '13:00', timeOut: '17:00' },
      period: p && { id: p.id, label: p.label, status: p.status },
      rows: db.employees
        .filter((e) => e.status !== 'resigned' && e.hireDate <= date)
        .map((e) => {
          const r = timeRecords.get(`${date}|${e.id}`)
          const lateBy = r?.timeIn ? toMin(r.timeIn) - 8 * 60 : 0
          const late = lateBy > db.settings.graceMinutes ? lateBy : 0
          return {
            employeeId: e.id,
            employeeNo: e.employeeNo,
            name: e.fullName,
            department: e.department,
            ...(r ?? emptyPunches),
            source: r?.source ?? null,
            status: r?.timeIn
              ? late
                ? 'late'
                : 'present'
              : e.status === 'on_leave'
                ? 'leave'
                : weekend
                  ? 'rest'
                  : date < today
                    ? 'absent'
                    : 'pending',
            lateMinutes: late,
            hoursWorked: r ? hoursOf(r) : 0,
            cutoffOverridden: !!p && overrides.has(`${p.id}|${e.id}`),
          } satisfies DailyRow
        }),
    })
  },

  async saveTimeRecords(source, rows) {
    const today = manilaToday()
    for (const r of rows) {
      if (r.date > today) throw new ApiError(`${r.date}: time records can’t be entered for future days`)
      const problem = punchError(r)
      if (problem) throw new ApiError(`${r.date}: ${problem}`)
    }
    const dates = [...new Set(rows.map((r) => r.date))].sort()
    for (const p of db.periods.filter((x) => dates.some((d) => x.start <= d && d <= x.end))) reopenForAttendance(p.id)
    let saved = 0
    let cleared = 0
    for (const { employeeId, date, ...punches } of rows) {
      if (!punches.timeIn) cleared += Number(timeRecords.delete(`${date}|${employeeId}`))
      else (timeRecords.set(`${date}|${employeeId}`, { ...punches, source }), saved++)
    }
    log(source === 'upload' ? 'Uploaded time records' : 'Edited time records', `${dates.join(', ')} · ${saved} saved`)
    return wait({ saved, cleared, dates }, 500)
  },

  getPayrollLines: async (periodId) => wait(lines.get(periodId) ?? []),

  async computePayroll(periodId) {
    const p = findPeriod(periodId)
    if (p.status === 'approved' || p.status === 'released') throw new ApiError('Approved payroll can no longer be recomputed')
    const rows = computeLines(p)
    lines.set(p.id, rows)
    applyTotals(p, rows)
    p.status = 'computed'
    p.computedAt = new Date().toISOString()
    log('Computed payroll', p.label)
    return wait(p, 1200)
  },

  async setPeriodStatus(periodId, status) {
    const p = findPeriod(periodId)
    if (nextStatus[p.status] !== status && !(status === 'computed' && p.status === 'review')) {
      throw new ApiError(`Cannot move payroll from ${p.status} to ${status}`)
    }
    p.status = status
    if (status === 'approved') p.approvedBy = actor
    if (status === 'released') p.releasedAt = new Date().toISOString()
    log(
      {
        computed: 'Returned payroll for changes',
        review: 'Submitted payroll for review',
        approved: 'Approved payroll',
        released: 'Released payroll',
        draft: 'Reset payroll',
      }[status],
      p.label,
    )
    return wait(p, 700)
  },

  listAdjustments: () => wait(db.adjustments),
  async saveAdjustment(input) {
    const emp = db.employees.find((e) => e.id === input.employeeId)
    if (!emp) throw new ApiError('Employee not found', 404)
    if (input.id) {
      const a = db.adjustments.find((x) => x.id === input.id)!
      Object.assign(a, input, { employeeName: emp.fullName })
      return wait(a, 400)
    }
    const created = { ...input, id: `adj_${Date.now()}`, employeeName: emp.fullName }
    db.adjustments.unshift(created)
    log(`Added ${input.kind}`, `${input.name} · ${emp.fullName}`)
    return wait(created, 400)
  },

  listOvertime: () => wait(db.overtime),
  async decideOvertime(id, status) {
    const ot = db.overtime.find((x) => x.id === id)
    if (!ot) throw new ApiError('Request not found', 404)
    ot.status = status
    log(status === 'approved' ? 'Approved overtime' : 'Rejected overtime', ot.employeeName)
    return wait(ot, 400)
  },

  listLeaves: () => wait(db.leaves),
  async decideLeave(id, status) {
    const l = db.leaves.find((x) => x.id === id)
    if (!l || l.status !== 'pending') throw new ApiError('Pending leave not found', 404)
    l.status = status
    log(status === 'approved' ? 'Approved leave' : 'Rejected leave', l.employeeName)
    return wait(l, 400)
  },

  listRequests: () => wait(demoRequests),
  async decideRequest(id, status, ot) {
    const r = demoRequests.find((x) => x.id === id)
    if (!r || r.status !== 'pending') throw new ApiError('Pending request not found', 404)
    if (status === 'approved' && r.kind === 'overtime') {
      if (!ot) throw new ApiError('Enter the overtime date, hours and type to approve it')
      db.overtime.unshift({
        id: `ot_${Date.now()}`,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        department: r.department,
        ...ot,
        reason: r.details,
        status: 'approved',
        requestId: r.id,
      })
      r.overtime = ot
    }
    r.status = status
    r.decidedBy = actor
    log(`${status === 'approved' ? 'Approved' : 'Rejected'} ${r.title.toLowerCase()}`, r.employeeName)
    return wait(r, 400)
  },

  listAnnouncements: () => wait(db.announcements),
  async saveAnnouncement(input) {
    if (input.id) {
      const a = db.announcements.find((x) => x.id === input.id)!
      Object.assign(a, input)
      return wait(a, 400)
    }
    const created = { ...input, id: `an_${Date.now()}`, author: actor, publishedAt: new Date().toISOString() }
    db.announcements.unshift(created)
    log(input.status === 'published' ? 'Published announcement' : 'Saved announcement draft', input.title)
    return wait(created, 400)
  },

  getSettings: () => wait(db.settings),
  async saveSettings(input) {
    Object.assign(db.settings, input)
    log('Updated payroll settings', 'Settings')
    return wait(db.settings, 500)
  },

  listAudit: () => wait(db.audit, 200),
}

/** Demo stand-in for AZONE profile photos: two employees get a simple drawn portrait, everyone else shows initials. */
function demoPhoto(employeeId: string) {
  const e = db.employees.find((x) => x.id === employeeId)
  if (!e || !['Leonard', 'Maria'].includes(e.firstName)) return null
  const bg = e.firstName === 'Leonard' ? '#1557e0' : '#eb6834'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#ffe0c2"/><path d="M10 64c2-14 12-21 22-21s20 7 22 21z" fill="#fff"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** Demo AZONE requests (in the real app employees file these under AZONE → Requests). */
const demoRequests: AzoneRequest[] = (
  [
    ['Leonard', 'overtime', 'Overtime Request', 'Stayed 3 hours after shift to finish the month-end report.', 0],
    ['Maria', 'coe', 'Certificate of Employment', 'Needed for a bank loan application, please include compensation.', 1],
    ['Jasmine', 'schedule_change', 'Schedule Change', 'Requesting 10 AM – 7 PM for two weeks while my child’s school schedule changes.', 2],
    ['Camille', 'maternity_leave', 'Maternity Leave', 'Expected delivery on Nov 20; planning 105 days starting Nov 10.', 3],
    ['Joshua', 'other', 'Other Request', 'Requesting a replacement company ID — the old one was damaged.', 4],
  ] as const
).map(([first, kind, title, details, i]) => {
  const e = db.employees.find((x) => x.firstName === first) ?? db.employees[i]
  return {
    id: `req_${i}`,
    employeeId: e.id,
    employeeName: e.fullName,
    department: e.department,
    kind,
    title,
    details,
    status: 'pending' as const,
    filedAt: new Date(Date.now() - (i + 1) * 5 * 3600 * 1000).toISOString(),
  }
})
