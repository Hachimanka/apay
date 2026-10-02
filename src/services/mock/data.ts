import { addDays, endOfMonth, format, isWeekend, startOfMonth } from 'date-fns'
import type {
  Adjustment,
  Announcement,
  AttendanceRow,
  AuditEntry,
  Employee,
  LeaveRecord,
  OvertimeRequest,
  PayrollPeriod,
  PayrollSettings,
} from '../types'

/** Deterministic pseudo-random numbers so the demo looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261002)
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/* --------------------------------- Employees --------------------------------- */

const people: [string, string, string, string, number][] = [
  ['Leonard', 'Forrosuelo', 'IT Department', 'Software Engineer', 50000],
  ['Maria', 'Santos', 'IT Department', 'IT Manager', 95000],
  ['Jose', 'Reyes', 'Finance', 'Finance Manager', 88000],
  ['Ana', 'Cruz', 'HR Department', 'HR Manager', 82000],
  ['Mark', 'Bautista', 'Operations', 'Operations Supervisor', 45000],
  ['Kristine', 'Villanueva', 'Finance', 'Payroll Specialist', 38000],
  ['Paolo', 'Garcia', 'Sales & Marketing', 'Account Executive', 32000],
  ['Jasmine', 'Mendoza', 'Customer Service', 'CS Team Lead', 30000],
  ['Rafael', 'Ramos', 'Operations', 'Logistics Coordinator', 26000],
  ['Camille', 'Aquino', 'HR Department', 'Recruitment Specialist', 34000],
  ['Miguel', 'Torres', 'IT Department', 'Systems Administrator', 48000],
  ['Patricia', 'Flores', 'Sales & Marketing', 'Marketing Associate', 28000],
  ['Joshua', 'Navarro', 'Operations', 'Warehouse Staff', 18500],
  ['Bea', 'Castillo', 'Customer Service', 'CS Representative', 21000],
  ['Carlo', 'Domingo', 'Finance', 'Accountant', 42000],
  ['Nicole', 'Lim', 'Sales & Marketing', 'Sales Manager', 78000],
  ['Gabriel', 'Tan', 'IT Department', 'QA Engineer', 40000],
  ['Andrea', 'Del Rosario', 'Customer Service', 'CS Representative', 21000],
  ['Ramon', 'Fernandez', 'Operations', 'Driver', 19000],
  ['Sofia', 'Gonzales', 'HR Department', 'HR Associate', 27000],
  ['Luis', 'Pascual', 'Operations', 'Warehouse Staff', 18500],
  ['Hannah', 'Rivera', 'Finance', 'Billing Associate', 25000],
  ['Daniel', 'Ocampo', 'Sales & Marketing', 'Account Executive', 32000],
  ['Erika', 'Salazar', 'IT Department', 'UI/UX Designer', 45000],
]

export const employees: Employee[] = people.map(([firstName, lastName, department, position, salary], i) => {
  const year = 2015 + Math.floor(rand() * 11)
  return {
    id: `emp_${String(i + 1).padStart(3, '0')}`,
    employeeNo: i === 0 ? 'AZN-2021-0148' : `AZN-${year}-${String(100 + i * 7).padStart(4, '0')}`,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${firstName}.${lastName}`.toLowerCase().replace(/\s/g, '') + '@aznar.com',
    position,
    department,
    employmentType: i % 11 === 10 ? 'Probationary' : i % 13 === 12 ? 'Contractual' : 'Regular',
    status: i === 19 ? 'on_leave' : 'active',
    monthlyBasic: `${salary}.00`,
    hireDate: i === 0 ? '2021-03-01' : `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-01`,
    taxStatus: pick(['S', 'ME', 'S1', 'ME1', 'ME2'] as const),
    bank: { name: pick(['BDO', 'BPI', 'Metrobank', 'UnionBank'] as const), account: `•••• ${1000 + Math.floor(rand() * 8999)}` },
    govIds: {
      sss: `34-${1000000 + Math.floor(rand() * 8999999)}-${Math.floor(rand() * 9)}`,
      philhealth: `12-${100000000 + Math.floor(rand() * 899999999)}-${Math.floor(rand() * 9)}`,
      pagibig: `1211-${1000 + Math.floor(rand() * 8999)}-${1000 + Math.floor(rand() * 8999)}`,
      tin: `${100 + Math.floor(rand() * 899)}-${100 + Math.floor(rand() * 899)}-${100 + Math.floor(rand() * 899)}-000`,
    },
  }
})

/* ---------------------------------- Periods ---------------------------------- */

function cutoffContaining(date: Date) {
  return date.getDate() <= 15
    ? { start: startOfMonth(date), end: new Date(date.getFullYear(), date.getMonth(), 15) }
    : { start: new Date(date.getFullYear(), date.getMonth(), 16), end: endOfMonth(date) }
}

function previousCutoff(c: { start: Date }) {
  return cutoffContaining(addDays(c.start, -1))
}

function periodLabel(start: Date, end: Date) {
  return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
}

/** Current open cut-off plus the six before it. Totals are filled in by the mock API. */
export const periods: PayrollPeriod[] = (() => {
  const list: PayrollPeriod[] = []
  let c = cutoffContaining(new Date())
  for (let i = 0; i < 7; i++) {
    const open = i === 0
    list.push({
      id: `pp_${iso(c.end)}`,
      label: periodLabel(c.start, c.end),
      start: iso(c.start),
      end: iso(c.end),
      payDate: iso(c.end),
      status: open ? 'draft' : 'released',
      headcount: 0,
      gross: '0.00',
      deductions: '0.00',
      net: '0.00',
      employerContributions: '0.00',
      approvedBy: open ? undefined : 'Jose Reyes',
      releasedAt: open ? undefined : c.end.toISOString(),
    })
    c = previousCutoff(c)
  }
  return list
})()

export function workingDays(start: string, end: string) {
  let n = 0
  for (let d = new Date(start); d <= new Date(end); d = addDays(d, 1)) if (!isWeekend(d)) n++
  return n
}

/** Attendance summary per employee for a cut-off (seeded per period so it is stable). */
export function buildAttendance(period: PayrollPeriod): AttendanceRow[] {
  const r = rng(Number(period.end.replaceAll('-', '')))
  const wd = workingDays(period.start, period.end)
  return employees
    .filter((e) => e.status !== 'resigned')
    .map((e) => {
      const roll = r()
      const absentDays = roll > 0.93 ? 1 : 0
      const unpaidLeaveDays = e.status === 'on_leave' ? 2 : roll < 0.03 ? 1 : 0
      const paidLeaveDays = roll > 0.8 && roll <= 0.93 ? 1 : 0
      const lateMinutes = r() > 0.7 ? Math.round(r() * 45) : 0
      const overtimeHours = r() > 0.6 ? Math.round(r() * 6) : 0
      return {
        employeeId: e.id,
        employeeNo: e.employeeNo,
        name: e.fullName,
        department: e.department,
        workingDays: wd,
        daysPresent: wd - absentDays - unpaidLeaveDays - paidLeaveDays,
        absentDays,
        lateMinutes,
        overtimeHours,
        paidLeaveDays,
        unpaidLeaveDays,
      }
    })
}

/* ------------------------ Allowances, deductions & loans ------------------------ */

export const adjustments: Adjustment[] = [
  ...employees.map<Adjustment>((e, i) => ({
    id: `adj_rice_${i}`,
    employeeId: e.id,
    employeeName: e.fullName,
    kind: 'allowance',
    category: 'de_minimis',
    name: 'Rice Subsidy',
    amount: '1000.00',
    active: true,
  })),
  ...employees
    .filter((_, i) => i % 3 === 0)
    .map<Adjustment>((e, i) => ({
      id: `adj_transpo_${i}`,
      employeeId: e.id,
      employeeName: e.fullName,
      kind: 'allowance',
      category: 'taxable',
      name: 'Transportation Allowance',
      amount: '1000.00',
      active: true,
    })),
  {
    id: 'adj_loan_1',
    employeeId: 'emp_005',
    employeeName: 'Mark Bautista',
    kind: 'deduction',
    category: 'loan',
    name: 'SSS Salary Loan',
    amount: '1250.00',
    balance: '15000.00',
    active: true,
  },
  {
    id: 'adj_loan_2',
    employeeId: 'emp_013',
    employeeName: 'Joshua Navarro',
    kind: 'deduction',
    category: 'loan',
    name: 'Pag-IBIG MPL',
    amount: '850.00',
    balance: '9350.00',
    active: true,
  },
  {
    id: 'adj_loan_3',
    employeeId: 'emp_009',
    employeeName: 'Rafael Ramos',
    kind: 'deduction',
    category: 'loan',
    name: 'Company Cash Advance',
    amount: '2000.00',
    balance: '4000.00',
    active: true,
  },
  {
    id: 'adj_other_1',
    employeeId: 'emp_007',
    employeeName: 'Paolo Garcia',
    kind: 'deduction',
    category: 'other',
    name: 'HMO Dependent',
    amount: '650.00',
    active: true,
  },
]

/* ---------------------------- Overtime & leave records ---------------------------- */

const today = new Date()
const daysAgo = (n: number) => iso(addDays(today, -n))

export const overtime: OvertimeRequest[] = [
  {
    id: 'ot_1',
    employeeId: 'emp_001',
    employeeName: 'Leonard Forrosuelo',
    department: 'IT Department',
    date: daysAgo(1),
    hours: 3,
    kind: 'regular',
    reason: 'Production deployment support',
    status: 'pending',
  },
  {
    id: 'ot_2',
    employeeId: 'emp_011',
    employeeName: 'Miguel Torres',
    department: 'IT Department',
    date: daysAgo(1),
    hours: 4,
    kind: 'restDay',
    reason: 'Server migration',
    status: 'pending',
  },
  {
    id: 'ot_3',
    employeeId: 'emp_005',
    employeeName: 'Mark Bautista',
    department: 'Operations',
    date: daysAgo(2),
    hours: 2,
    kind: 'regular',
    reason: 'Inventory count',
    status: 'pending',
  },
  {
    id: 'ot_4',
    employeeId: 'emp_009',
    employeeName: 'Rafael Ramos',
    department: 'Operations',
    date: daysAgo(5),
    hours: 3,
    kind: 'regular',
    reason: 'Late deliveries',
    status: 'approved',
  },
  {
    id: 'ot_5',
    employeeId: 'emp_008',
    employeeName: 'Jasmine Mendoza',
    department: 'Customer Service',
    date: daysAgo(8),
    hours: 2,
    kind: 'regular',
    reason: 'Ticket backlog',
    status: 'approved',
  },
  {
    id: 'ot_6',
    employeeId: 'emp_013',
    employeeName: 'Joshua Navarro',
    department: 'Operations',
    date: daysAgo(9),
    hours: 8,
    kind: 'regularHoliday',
    reason: 'Holiday shipment',
    status: 'rejected',
  },
]

export const leaves: LeaveRecord[] = [
  {
    id: 'lv_1',
    employeeId: 'emp_001',
    employeeName: 'Leonard Forrosuelo',
    department: 'IT Department',
    type: 'vacation',
    start: iso(addDays(today, 12)),
    end: iso(addDays(today, 13)),
    days: 2,
    paid: true,
    status: 'pending',
  },
  {
    id: 'lv_2',
    employeeId: 'emp_020',
    employeeName: 'Sofia Gonzales',
    department: 'HR Department',
    type: 'unpaid',
    start: daysAgo(1),
    end: iso(addDays(today, 10)),
    days: 8,
    paid: false,
    status: 'approved',
  },
  {
    id: 'lv_3',
    employeeId: 'emp_014',
    employeeName: 'Bea Castillo',
    department: 'Customer Service',
    type: 'sick',
    start: daysAgo(3),
    end: daysAgo(3),
    days: 1,
    paid: true,
    status: 'approved',
  },
  {
    id: 'lv_4',
    employeeId: 'emp_012',
    employeeName: 'Patricia Flores',
    department: 'Sales & Marketing',
    type: 'vacation',
    start: daysAgo(15),
    end: daysAgo(13),
    days: 3,
    paid: true,
    status: 'approved',
  },
  {
    id: 'lv_5',
    employeeId: 'emp_019',
    employeeName: 'Ramon Fernandez',
    department: 'Operations',
    type: 'emergency',
    start: daysAgo(20),
    end: daysAgo(20),
    days: 1,
    paid: true,
    status: 'approved',
  },
  {
    id: 'lv_6',
    employeeId: 'emp_021',
    employeeName: 'Luis Pascual',
    department: 'Operations',
    type: 'unpaid',
    start: daysAgo(25),
    end: daysAgo(24),
    days: 2,
    paid: false,
    status: 'approved',
  },
]

/* -------------------------------- Announcements -------------------------------- */

export const announcements: Announcement[] = [
  {
    id: 'an_31',
    category: 'HR',
    title: 'Company Holiday Schedule',
    body: 'The company holiday schedule for the remainder of the year has been released. Holiday pay is computed automatically by APAY.',
    author: 'HR Department',
    publishedAt: addDays(today, -1).toISOString(),
    status: 'published',
    audience: 'all',
  },
  {
    id: 'an_29',
    category: 'Policy',
    title: 'Updated Leave Policy',
    body: 'Effective next month, vacation leave must be filed at least 5 working days in advance.',
    author: 'HR Department',
    publishedAt: addDays(today, -7).toISOString(),
    status: 'published',
    audience: 'all',
  },
  {
    id: 'an_32',
    category: 'General',
    title: '13th Month Pay Schedule',
    body: 'The 13th month pay will be released together with the December 1–15 payroll.',
    author: 'Payroll',
    publishedAt: today.toISOString(),
    status: 'draft',
    audience: 'all',
  },
]

/* ---------------------------------- Settings ---------------------------------- */

export const settings: PayrollSettings = {
  companyName: 'Aznar',
  payFrequency: 'semi-monthly',
  firstCutoff: { start: 1, end: 15, payDay: 15 },
  secondCutoff: { start: 16, end: 31, payDay: 'last' },
  graceMinutes: 5,
  roundLateTo: 1,
  requireTwoStepApproval: true,
  autoPublishToAzone: true,
}

export const audit: AuditEntry[] = periods
  .filter((p) => p.status === 'released')
  .slice(0, 3)
  .flatMap((p, i) => [
    { id: `au_${i}_r`, at: p.releasedAt!, actor: 'Kristine Villanueva', action: 'Released payroll', target: p.label },
    { id: `au_${i}_a`, at: addDays(new Date(p.end), -1).toISOString(), actor: 'Jose Reyes', action: 'Approved payroll', target: p.label },
  ])
