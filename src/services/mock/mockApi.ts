import { computeCutoff, dailyRate, sum } from '@/lib/payroll'
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
import { movementFor, recordConfigs } from '@/features/employees/records'
import type { Cadet, CrewStint, EmployeeProfileInput, EmployeeRecord, FilingKind, FinalPay, Holiday, Loan, PayEntry, PayslipEmail, Shift, Vessel } from '../types'

/** Holiday calendar and shift codes (demo only). The official list mirrors aznar-api src/lib/holidays.ts (2027 shown). */
const officialHolidays: Holiday[] = [
  { date: '2026-11-30', name: 'Bonifacio Day', type: 'regular' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'special' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'special' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'regular' },
  { date: '2026-12-30', name: 'Rizal Day', type: 'regular' },
  { date: '2026-12-31', name: 'Last Day of the Year', type: 'special' },
  { date: '2027-01-01', name: 'New Year’s Day', type: 'regular' },
  { date: '2027-02-06', name: 'Chinese New Year', type: 'special' },
  { date: '2027-03-25', name: 'Maundy Thursday', type: 'regular' },
  { date: '2027-03-26', name: 'Good Friday', type: 'regular' },
  { date: '2027-03-27', name: 'Black Saturday', type: 'special' },
  { date: '2027-04-09', name: 'Araw ng Kagitingan', type: 'regular' },
  { date: '2027-05-01', name: 'Labor Day', type: 'regular' },
  { date: '2027-06-12', name: 'Independence Day', type: 'regular' },
]
const holidays: Holiday[] = officialHolidays.slice(0, 6).map((h) => ({ ...h }))
const shifts: Shift[] = [
  { id: 'shf_day', code: 'DAY', name: 'Day shift', startMinutes: 480, endMinutes: 1020, breakMinutes: 60, restDays: [0, 6], active: true, employees: 0 },
  { id: 'shf_night', code: 'NIGHT', name: 'Night shift', startMinutes: 1320, endMinutes: 420, breakMinutes: 60, restDays: [0, 6], active: true, employees: 0 },
]

/** 201-file records and HR-edited profile fields (demo only; reset on reload). */
const records: EmployeeRecord[] = []
const profiles = new Map<string, EmployeeProfileInput>()

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
      // Demo cut-offs are seeded totals (no punches), so holiday work and night hours stay 0 here
      payBasis: emp.payBasis,
      daysPresent: a.daysPresent,
      paidLeaveDays: a.paidLeaveDays,
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
      gender: '' as const,
      civilStatus: '' as const,
      permanentAddress: '',
      spouseName: '',
      skills: [] as string[],
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
      ...profiles.get(e.id),
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
    const { gender, civilStatus, address, permanentAddress, birthday, spouseName, skills, ...core } = input
    const profile = Object.fromEntries(
      Object.entries({ gender, civilStatus, address, permanentAddress, birthday, spouseName, skills }).filter(([, v]) => v !== undefined),
    )
    profiles.set(e.id, { ...profiles.get(e.id), ...profile })
    const move = movementFor(e, { ...e, ...core })
    Object.assign(e, core, { fullName })
    if (move) {
      const now = new Date().toISOString()
      records.unshift({ id: `rec_${Date.now()}`, employeeId: e.id, kind: 'movement', auto: true, createdAt: now, updatedAt: now, data: { effectiveDate: manilaToday(), ...move, remarks: '' } })
    }
    log('Updated employee', fullName)
    return wait(e, 500)
  },

  listEmployeeRecords: async (employeeId) => wait(records.filter((r) => r.employeeId === employeeId)),
  async saveEmployeeRecord({ id, employeeId, kind, data }) {
    const e = db.employees.find((x) => x.id === employeeId)
    if (!e) throw new ApiError('Employee not found', 404)
    const now = new Date().toISOString()
    if (id) {
      const r = records.find((x) => x.id === id && x.employeeId === employeeId)
      if (!r) throw new ApiError('Record not found', 404)
      if (r.auto) throw new ApiError('Movement logged automatically from employee changes can’t be edited or deleted', 403)
      Object.assign(r, { data, updatedAt: now })
      log(`Updated ${recordConfigs[kind].singular} record`, e.fullName)
      return wait(r)
    }
    const r: EmployeeRecord = { id: `rec_${Date.now()}`, employeeId, kind, data, auto: false, createdAt: now, updatedAt: now }
    records.unshift(r)
    log(`Added ${recordConfigs[kind].singular} record`, e.fullName)
    return wait(r)
  },
  async deleteEmployeeRecord(employeeId, id) {
    const i = records.findIndex((x) => x.id === id && x.employeeId === employeeId)
    if (i < 0) throw new ApiError('Record not found', 404)
    if (records[i].auto) throw new ApiError('Movement logged automatically from employee changes can’t be edited or deleted', 403)
    const [r] = records.splice(i, 1)
    log(`Deleted ${recordConfigs[r.kind].singular} record`, db.employees.find((x) => x.id === employeeId)?.fullName ?? '')
    await wait(null)
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
      const d = r.data as { date?: string; hours?: number } | null | undefined
      if (!ot && d?.date && d.hours) ot = { date: d.date, hours: d.hours, kind: 'regular' }
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
  async decideRequests(ids, status) {
    const results: { id: string; ok: boolean; error?: string }[] = []
    for (const id of ids) {
      try {
        await mockApi.decideRequest(id, status)
        results.push({ id, ok: true })
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : 'Failed' })
      }
    }
    return wait({ results })
  },
  async fileRequest(input) {
    const emp = db.employees.find((e) => e.id === input.employeeId)
    if (!emp) throw new ApiError('Employee not found', 404)
    const d = input.data as Record<string, string>
    const created: AzoneRequest = {
      id: `req_${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      department: emp.department,
      kind: input.kind,
      title: filingTitle[input.kind],
      details: input.details,
      status: 'pending',
      filedAt: new Date().toISOString(),
      data: input.data,
      startDate: d.startDate ?? d.date,
      endDate: d.endDate ?? d.date,
      filedByHr: true,
    }
    demoRequests.unshift(created)
    log(`Filed ${created.title.toLowerCase()} on behalf of employee`, emp.fullName)
    return input.approve ? mockApi.decideRequest(created.id, 'approved') : wait(created, 400)
  },

  listPayEntries: (periodId) => wait(payEntries.filter((e) => e.periodId === periodId)),
  async addPayEntry(periodId, input) {
    const emp = db.employees.find((e) => e.id === input.employeeId)
    if (!emp) throw new ApiError('Employee not found', 404)
    const labels: Record<string, string> = {
      thirteenth_month: '13th Month Pay',
      bonus: 'Bonus',
      leave_conversion: 'Vacation Leave Conversion',
      other_taxable: 'Other Earning (taxable)',
      other_non_taxable: 'Other Earning (non-taxable)',
      deduction: 'Deduction',
    }
    const amount = input.kind === 'leave_conversion' ? dailyRate(emp.monthlyBasic).times(input.days ?? 0).toFixed(2) : Number(input.amount ?? 0).toFixed(2)
    payEntries.push({
      id: `pe_${Date.now()}`,
      periodId,
      employeeId: emp.id,
      employeeName: emp.fullName,
      department: emp.department,
      kind: input.kind,
      kindLabel: labels[input.kind],
      label: input.label || labels[input.kind],
      amount,
      days: input.days,
    })
    return mockApi.listPayEntries(periodId)
  },
  async deletePayEntry(periodId, entryId) {
    const i = payEntries.findIndex((e) => e.id === entryId)
    if (i >= 0) payEntries.splice(i, 1)
    return mockApi.listPayEntries(periodId)
  },
  async convertVacationLeave(periodId, maxDays) {
    let added = 0
    for (const e of db.employees.filter((x) => x.status !== 'resigned')) {
      await mockApi.addPayEntry(periodId, { employeeId: e.id, kind: 'leave_conversion', days: Math.min(5, maxDays ?? 5) })
      added++
    }
    return { added, entries: await mockApi.listPayEntries(periodId) }
  },
  async thirteenthMonth(year) {
    const months = year === manilaToday().slice(0, 4) ? Number(manilaToday().slice(5, 7)) - 1 : 12
    return wait(
      db.employees.map((e) => {
        const basicEarned = (Number(e.monthlyBasic) * months).toFixed(2)
        const accrued = (Number(basicEarned) / 12).toFixed(2)
        return { employeeId: e.id, employeeNo: e.employeeNo, name: e.fullName, department: e.department, status: e.status, cutoffs: months * 2, basicEarned, accrued, paid: '0.00', due: accrued }
      }),
    )
  },

  listFinalPays: () => wait(finalPays),

  listVessels: () => wait(vessels.map((v) => ({ ...v, aboard: crew.filter((c) => c.vesselId === v.id && c.aboard).length }))),
  async saveVessel(input) {
    const v = { aboard: 0, ...input, id: input.id ?? `v_${Date.now()}` }
    const i = vessels.findIndex((x) => x.id === v.id)
    if (i >= 0) vessels.splice(i, 1, v)
    else vessels.push(v)
    return wait(v)
  },
  listCrew: (f = {}) => wait(crew.filter((c) => (!f.employeeId || c.employeeId === f.employeeId) && (!f.aboard || c.aboard))),
  async saveCrewStint(input) {
    const emp = db.employees.find((e) => e.id === input.employeeId)
    const v = vessels.find((x) => x.id === input.vesselId)
    const s: CrewStint = {
      ...input,
      id: input.id ?? `cs_${Date.now()}`,
      employeeName: emp?.fullName,
      vesselName: v?.name,
      disembarkDate: input.disembarkDate ?? undefined,
      disembarkReason: input.disembarkReason ?? undefined,
      days: 1,
      aboard: !input.disembarkDate,
    }
    const i = crew.findIndex((x) => x.id === s.id)
    if (i >= 0) crew.splice(i, 1, s)
    else crew.unshift(s)
    return wait(s)
  },
  async deleteCrewStint(id) {
    const i = crew.findIndex((x) => x.id === id)
    if (i >= 0) crew.splice(i, 1)
    await wait(null)
  },
  async disembark(id, input) {
    const s = crew.find((x) => x.id === id)
    if (!s) throw new ApiError('Crew record not found', 404)
    Object.assign(s, { disembarkDate: input.date, disembarkPort: input.port, disembarkReason: input.transferTo ? 'transfer' : input.reason, aboard: false })
    const next = input.transferTo
      ? await mockApi.saveCrewStint({
          employeeId: s.employeeId,
          vesselId: input.transferTo.vesselId,
          rank: input.transferTo.rank ?? s.rank,
          embarkDate: input.date,
          embarkPort: input.port,
          disembarkDate: null,
          disembarkPort: '',
          disembarkReason: null,
          remarks: '',
        })
      : undefined
    return wait({ closed: s, next })
  },
  listCadets: () => wait(cadets),
  async saveCadet(input) {
    const existing = cadets.find((c) => c.id === input.id)
    const c: Cadet = { stage: 'applicant', stageHistory: [], seaDays: 0, seaProgress: 0, ...existing, ...input, id: input.id ?? `cd_${Date.now()}` }
    if (existing) Object.assign(existing, c)
    else cadets.push(c)
    return wait(c)
  },
  async moveCadet(id, stage, note = '') {
    const c = cadets.find((x) => x.id === id)
    if (!c) throw new ApiError('Cadet not found', 404)
    c.stage = stage
    c.stageHistory.push({ stage, date: manilaToday(), note, by: actor })
    return wait(c)
  },
  listLicenses: () => wait([]),

  listReports: () =>
    wait([
      { key: 'demographics', group: 'Workforce', params: [] },
      { key: 'tenure', group: 'Workforce', params: [] },
    ]),
  async runReport(key) {
    const rows = db.employees.map((e) => ({ name: e.fullName, department: e.department, value: e.position }))
    return wait({
      key,
      title: key === 'tenure' ? 'Tenure' : 'Manpower demographics',
      description: 'Demo data — connect the API to see the real report.',
      columns: [
        { key: 'name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'value', label: 'Position' },
      ],
      rows,
    })
  },
  getFinalPay: (employeeId) => wait(finalPays.find((f) => f.employeeId === employeeId) ?? null),
  async computeFinalPay(employeeId, separationDate) {
    const emp = db.employees.find((e) => e.id === employeeId)
    if (!emp) throw new ApiError('Employee not found', 404)
    const half = (Number(emp.monthlyBasic) / 2).toFixed(2)
    const th = ((Number(emp.monthlyBasic) * Number(separationDate.slice(5, 7))) / 12).toFixed(2)
    const f: FinalPay = {
      id: `fp_${employeeId}`,
      employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      separationDate,
      status: 'draft',
      earnings: [
        { key: 'salary', label: 'Salary (demo)', amount: half, included: true },
        { key: 'thirteenth', label: 'Prorated 13th month pay', amount: th, included: true },
      ],
      deductions: [{ key: 'tax', label: 'Withholding tax (year-end adjustment)', amount: '1250.00', included: true }],
      clearance: [
        { key: 'handover', label: 'Work turned over to the department', done: false },
        { key: 'id', label: 'Company ID returned', done: false },
        { key: 'quitclaim', label: 'Quitclaim / release signed', done: false },
      ],
      basis: { separationDate, dailyRate: dailyRate(emp.monthlyBasic).toFixed(2) },
      netPay: (Number(half) + Number(th) - 1250).toFixed(2),
      updatedAt: new Date().toISOString(),
    }
    const i = finalPays.findIndex((x) => x.employeeId === employeeId)
    if (i >= 0) finalPays.splice(i, 1, f)
    else finalPays.push(f)
    return wait(f, 500)
  },
  async saveFinalPay(employeeId, input) {
    const f = finalPays.find((x) => x.employeeId === employeeId)
    if (!f) throw new ApiError('Final pay not found', 404)
    Object.assign(f, input)
    const total = (xs: FinalPay['earnings']) => xs.filter((x) => x.included).reduce((s, x) => s + Number(x.amount), 0)
    f.netPay = (total(f.earnings) - total(f.deductions)).toFixed(2)
    return wait(f)
  },
  async setFinalPayStatus(employeeId, status) {
    const f = finalPays.find((x) => x.employeeId === employeeId)
    if (!f) throw new ApiError('Final pay not found', 404)
    if (status === 'approved' && f.clearance.some((c) => !c.done)) throw new ApiError('Finish the clearance checklist before approving', 400)
    f.status = status
    if (status === 'released') {
      const emp = db.employees.find((e) => e.id === employeeId)
      if (emp) emp.status = 'resigned'
    }
    return wait(f)
  },
  async deleteFinalPay(employeeId) {
    const i = finalPays.findIndex((x) => x.employeeId === employeeId && x.status === 'draft')
    if (i < 0) throw new ApiError('Only a draft final pay can be removed', 409)
    finalPays.splice(i, 1)
    await wait(null)
  },

  async listLoans(employeeId) {
    const types: Record<string, string> = { sss: 'SSS Loan', pagibig: 'Pag-IBIG Loan', company: 'Company Loan', cash_advance: 'Cash Advance', other: 'Other Loan' }
    const loans: Loan[] = db.adjustments
      .filter((a) => a.kind === 'deduction' && (a.category === 'loan' || a.balance != null) && (!employeeId || a.employeeId === employeeId))
      .map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        name: a.name,
        loanType: a.loanType ?? 'other',
        typeLabel: types[a.loanType ?? 'other'],
        principal: a.principal,
        amortization: a.amount,
        balance: a.balance,
        totalPaid: '0.00',
        startDate: a.startDate,
        active: a.active,
        payments: [],
      }))
    return wait(loans)
  },

  getPayslipEmails: (periodId) => wait({ configured: false, log: payslipLog.filter((l) => l.periodId === periodId) }),
  async sendPayslipEmails(periodId, employeeIds) {
    const p = db.periods.find((x) => x.id === periodId)
    if (!p || p.status !== 'released') throw new ApiError('Payslips can only be emailed once the payroll is released', 409)
    const emps = db.employees.filter((e) => e.status !== 'resigned' && (!employeeIds || employeeIds.includes(e.id)))
    for (const e of emps)
      payslipLog.unshift({ id: `pe_${Date.now()}_${e.id}`, periodId, employeeId: e.id, employeeName: e.fullName, email: e.email, status: 'not_configured', sentAt: new Date().toISOString(), sentBy: actor })
    log('Resent payslip emails', p.label)
    return wait({ sent: 0, failed: 0, notConfigured: emps.length }, 500)
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

  listHolidays: async () => wait([...holidays].sort((a, b) => a.date.localeCompare(b.date))),
  async saveHoliday(input, originalDate) {
    const clash = holidays.find((h) => h.date === input.date && h.date !== originalDate)
    if (clash) throw new ApiError(`${input.date} is already a holiday (${clash.name})`, 409)
    if (originalDate) {
      const h = holidays.find((x) => x.date === originalDate)
      if (!h) throw new ApiError('Holiday not found', 404)
      Object.assign(h, input)
    } else holidays.push({ ...input })
    log(originalDate ? 'Updated holiday' : 'Added holiday', `${input.name} · ${input.date}`)
    return wait(input)
  },
  async deleteHoliday(date) {
    const i = holidays.findIndex((h) => h.date === date)
    if (i < 0) throw new ApiError('Holiday not found', 404)
    const [h] = holidays.splice(i, 1)
    log('Removed holiday', `${h.name} · ${h.date}`)
    await wait(null)
  },
  async loadOfficialHolidays() {
    const missing = officialHolidays.filter((o) => !holidays.some((h) => h.date === o.date))
    holidays.push(...missing.map((h) => ({ ...h })))
    if (missing.length) log('Loaded official holidays', `${missing.length} dates`)
    return wait({ added: missing.length })
  },

  listShifts: async () =>
    wait(shifts.map((s) => ({ ...s, employees: db.employees.filter((e) => e.shiftId === s.id && e.status !== 'resigned').length }))),
  async saveShift({ id, ...input }) {
    const code = input.code.trim().toUpperCase()
    if (shifts.some((s) => s.code === code && s.id !== id)) throw new ApiError(`Shift code ${code} is already used`, 409)
    let s = shifts.find((x) => x.id === id)
    if (id && !s) throw new ApiError('Shift not found', 404)
    if (s) Object.assign(s, input, { code })
    else shifts.push((s = { ...input, code, id: `shf_${Date.now()}`, employees: 0 }))
    log(id ? 'Updated shift' : 'Added shift', `${code} · ${input.name}`)
    return wait(s)
  },
  async deleteShift(id) {
    if (db.employees.some((e) => e.shiftId === id)) throw new ApiError('Employees are still assigned to this shift — move them first, or mark it inactive', 409)
    const i = shifts.findIndex((s) => s.id === id)
    if (i < 0) throw new ApiError('Shift not found', 404)
    const [s] = shifts.splice(i, 1)
    log('Deleted shift', `${s.code} · ${s.name}`)
    await wait(null)
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

const filingTitle: Record<FilingKind, string> = {
  dtr_discrepancy: 'DTR Discrepancy',
  no_dtr: 'No DTR',
  undertime: 'Undertime',
  official_business: 'Official Business',
  overtime: 'Overtime Request',
}

const payslipLog: (PayslipEmail & { periodId: string })[] = []
const payEntries: (PayEntry & { periodId: string })[] = []
const vessels: Vessel[] = [
  { id: 'v_1', name: 'MV Aznar Star', imoNo: '', type: 'roro', flag: 'Philippines', grossTonnage: 2400, homePort: 'Cebu', complement: 18, status: 'active', notes: '', aboard: 0 },
]
const crew: CrewStint[] = []
const cadets: Cadet[] = []
const finalPays: FinalPay[] = []

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
