/**
 * APAY ↔ aznar-api contract.
 * Money is always a decimal string (e.g. "24500.00") — never a float. Dates are ISO strings.
 */
import type { CutoffResult, Money, OvertimeKind } from '@/lib/payroll'

export type { Money, OvertimeKind }

export type Role = 'hr' | 'payroll_admin' | 'finance' | 'management'

export type User = { id: string; name: string; email: string; role: Role; title: string }

export type Session = { token: string; user: User }

export type EmploymentStatus = 'active' | 'on_leave' | 'resigned'

export type Employee = {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  position: string
  department: string
  employmentType: 'Regular' | 'Probationary' | 'Contractual'
  status: EmploymentStatus
  monthlyBasic: Money
  hireDate: string
  taxStatus: 'S' | 'ME' | 'S1' | 'ME1' | 'ME2'
  bank: { name: string; account: string }
  govIds: { sss: string; philhealth: string; pagibig: string; tin: string }
}

export type EmployeeInput = Omit<Employee, 'id' | 'fullName'> & { id?: string }

export type PeriodStatus = 'draft' | 'computed' | 'review' | 'approved' | 'released'

export type PayrollPeriod = {
  id: string
  label: string
  start: string
  end: string
  payDate: string
  status: PeriodStatus
  headcount: number
  gross: Money
  deductions: Money
  net: Money
  employerContributions: Money
  computedAt?: string
  approvedBy?: string
  releasedAt?: string
}

export type AttendanceRow = {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  workingDays: number
  daysPresent: number
  absentDays: number
  lateMinutes: number
  overtimeHours: number
  paidLeaveDays: number
  unpaidLeaveDays: number
}

export type PayrollLine = CutoffResult & {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  monthlyBasic: Money
}

export type AdjustmentKind = 'allowance' | 'deduction'
export type AdjustmentCategory = 'de_minimis' | 'taxable' | 'loan' | 'other'

export type Adjustment = {
  id: string
  employeeId: string
  employeeName: string
  kind: AdjustmentKind
  category: AdjustmentCategory
  name: string
  /** Amount applied every cut-off */
  amount: Money
  /** For loans: remaining balance */
  balance?: Money
  active: boolean
}

export type AdjustmentInput = Omit<Adjustment, 'id' | 'employeeName'> & { id?: string }

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type OvertimeRequest = {
  id: string
  employeeId: string
  employeeName: string
  department: string
  date: string
  hours: number
  kind: OvertimeKind
  reason: string
  status: ApprovalStatus
}

export type LeaveRecord = {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: 'vacation' | 'sick' | 'emergency' | 'birthday' | 'unpaid'
  start: string
  end: string
  days: number
  paid: boolean
  status: ApprovalStatus
}

export type AnnouncementCategory = 'HR' | 'General' | 'Policy' | 'Event'

export type Announcement = {
  id: string
  category: AnnouncementCategory
  title: string
  body: string
  author: string
  publishedAt: string
  status: 'published' | 'draft'
  audience: 'all' | string
}

export type AnnouncementInput = Pick<Announcement, 'category' | 'title' | 'body' | 'status' | 'audience'> & { id?: string }

export type PayrollSettings = {
  companyName: string
  payFrequency: 'semi-monthly'
  firstCutoff: { start: number; end: number; payDay: number }
  secondCutoff: { start: number; end: number; payDay: string }
  graceMinutes: number
  roundLateTo: number
  requireTwoStepApproval: boolean
  autoPublishToAzone: boolean
}

export type AuditEntry = { id: string; at: string; actor: string; action: string; target: string }

export interface ApayApi {
  login(email: string, password: string, role: Role): Promise<Session>

  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee>
  saveEmployee(input: EmployeeInput): Promise<Employee>

  listPeriods(): Promise<PayrollPeriod[]>
  getPeriod(id: string): Promise<PayrollPeriod>
  getAttendance(periodId: string): Promise<AttendanceRow[]>
  getPayrollLines(periodId: string): Promise<PayrollLine[]>
  computePayroll(periodId: string): Promise<PayrollPeriod>
  setPeriodStatus(periodId: string, status: PeriodStatus): Promise<PayrollPeriod>

  listAdjustments(): Promise<Adjustment[]>
  saveAdjustment(input: AdjustmentInput): Promise<Adjustment>

  listOvertime(): Promise<OvertimeRequest[]>
  decideOvertime(id: string, status: Exclude<ApprovalStatus, 'pending'>): Promise<OvertimeRequest>

  listLeaves(): Promise<LeaveRecord[]>

  listAnnouncements(): Promise<Announcement[]>
  saveAnnouncement(input: AnnouncementInput): Promise<Announcement>

  getSettings(): Promise<PayrollSettings>
  saveSettings(input: PayrollSettings): Promise<PayrollSettings>

  listAudit(): Promise<AuditEntry[]>
}
