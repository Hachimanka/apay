import { computeCutoff, sum } from '@/lib/payroll'
import type { ApayApi, Employee, PayrollLine, PayrollPeriod, PeriodStatus } from '../types'
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
let actor = 'Demo User'

function findPeriod(id: string) {
  const p = db.periods.find((x) => x.id === id)
  if (!p) throw new ApiError('Payroll period not found', 404)
  return p
}

function computeLines(period: PayrollPeriod): PayrollLine[] {
  const attendance = db.buildAttendance(period)
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
  async login(email, _password, role) {
    const names = { payroll_admin: 'Kristine Villanueva', hr: 'Ana Cruz', finance: 'Jose Reyes', management: 'Nicole Lim' }
    const titles = { payroll_admin: 'Payroll Specialist', hr: 'HR Manager', finance: 'Finance Manager', management: 'Sales Manager' }
    actor = names[role]
    return wait({ token: `mock.${btoa(email)}`, user: { id: `usr_${role}`, name: names[role], email, role, title: titles[role] } }, 600)
  },

  listEmployees: () => wait(db.employees),
  async getEmployee(id) {
    const e = db.employees.find((x) => x.id === id)
    if (!e) throw new ApiError('Employee not found', 404)
    return wait(e)
  },
  async saveEmployee(input) {
    const fullName = `${input.firstName} ${input.lastName}`
    if (input.id) {
      const e = db.employees.find((x) => x.id === input.id)
      if (!e) throw new ApiError('Employee not found', 404)
      Object.assign(e, input, { fullName })
      log('Updated employee', fullName)
      return wait(e, 500)
    }
    const created: Employee = { ...input, id: `emp_${Date.now()}`, fullName }
    db.employees.push(created)
    log('Added employee', fullName)
    return wait(created, 500)
  },

  listPeriods: () => wait(db.periods),
  getPeriod: async (id) => wait(findPeriod(id)),
  getAttendance: async (periodId) => wait(db.buildAttendance(findPeriod(periodId))),
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
