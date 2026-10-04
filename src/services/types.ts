/**
 * APAY ↔ aznar-api contract.
 * Money is always a decimal string (e.g. "24500.00") — never a float. Dates are ISO strings.
 */
import type { CutoffResult, Money, OvertimeKind } from '@/lib/payroll'

export type { Money, OvertimeKind }

/** APAY is run by the HR department alone; the API refuses every other account. */
export type Role = 'hr'

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
  /** When their AZONE photo last changed (null = no photo). Lists carry only this; the image is fetched per employee. */
  avatarVersion?: string | null
}

/** One employee plus what they keep up to date in their AZONE profile. */
export type EmployeeProfile = Employee & {
  phone: string
  address: string
  birthday: string
  manager: string
  workSchedule: string
  emergencyContact: { name: string; relation: string; phone: string }
  /** AZONE profile photo as a data URL, or null */
  avatarUrl: string | null
}

export type EmployeeInput = Omit<Employee, 'id' | 'fullName' | 'avatarVersion'> & { id?: string }

/** Returned once when an employee is added: their new AZONE login (the temporary password is never shown again). */
export type NewEmployeeResult = { employee: Employee; account: { email: string; temporaryPassword: string } }

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
  /** How many of daysPresent haven't happened yet (assumed present until the cut-off ends; 0 for HR-entered totals) */
  upcomingDays?: number
  /** dtr = from daily records; manual/upload = HR entered this cut-off's numbers directly */
  source: 'dtr' | 'manual' | 'upload'
}

/** HR-entered cut-off numbers for one employee (overtime stays with the Overtime approvals). */
export type AttendanceInput = Pick<AttendanceRow, 'employeeId' | 'daysPresent' | 'absentDays' | 'lateMinutes' | 'paidLeaveDays' | 'unpaidLeaveDays'>

/** Wall-clock punches for one day, 'HH:mm' (24-hour, Manila); null = not punched. */
export type Punches = { timeIn: string | null; breakOut: string | null; breakIn: string | null; timeOut: string | null }

export type DailyStatus = 'present' | 'late' | 'absent' | 'leave' | 'rest' | 'holiday' | 'pending'

export type DailyRow = Punches & {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  /** azone = employee's own punches; biometric/manual/upload = entered by HR or imported */
  source: 'azone' | 'biometric' | 'manual' | 'upload' | null
  status: DailyStatus
  lateMinutes: number
  hoursWorked: number
  /** HR set this employee's cut-off totals directly, so daily changes won't affect their pay until that is reset */
  cutoffOverridden: boolean
}

export type DailyAttendance = {
  date: string
  holiday: boolean
  weekend: boolean
  /** The regular shift, used to fill blank rows */
  shift: Punches
  period: { id: string; label: string; status: PeriodStatus } | null
  rows: DailyRow[]
}

export type TimeRecordInput = Punches & { employeeId: string; date: string }

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
  /** Set when it came from an AZONE overtime request */
  requestId?: string
}

/** Something an employee filed under AZONE → Requests (COE, schedule change, overtime, special leaves, others). */
export type AzoneRequest = {
  id: string
  employeeId: string
  employeeName: string
  department: string
  /** coe, schedule_change, overtime, maternity_leave, paternity_leave, solo_parent_leave, study_leave, other (older rows may hold retired kinds) */
  kind: string
  title: string
  details: string
  status: ApprovalStatus
  decidedBy?: string
  filedAt: string
  /** For approved overtime requests: the hours HR recorded for payroll */
  overtime?: { date: string; hours: number; kind: OvertimeKind }
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
  login(email: string, password: string): Promise<Session>
  /** Emails a one-time reset link if the address belongs to an APAY (HR) account; resolves the same either way */
  requestPasswordReset(email: string): Promise<void>
  resetPassword(token: string, password: string): Promise<void>

  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<EmployeeProfile>
  getEmployeeAvatar(id: string): Promise<{ dataUrl: string | null }>
  /** Adds the employee and creates their AZONE account in one step */
  createEmployee(input: EmployeeInput): Promise<NewEmployeeResult>
  saveEmployee(input: EmployeeInput & { id: string }): Promise<Employee>

  listPeriods(): Promise<PayrollPeriod[]>
  getPeriod(id: string): Promise<PayrollPeriod>
  getAttendance(periodId: string): Promise<AttendanceRow[]>
  saveAttendance(periodId: string, source: 'manual' | 'upload', rows: AttendanceInput[]): Promise<AttendanceRow[]>
  resetAttendance(periodId: string, employeeId: string): Promise<AttendanceRow[]>
  getDailyAttendance(date: string): Promise<DailyAttendance>
  saveTimeRecords(source: 'manual' | 'upload', rows: TimeRecordInput[]): Promise<{ saved: number; cleared: number; dates: string[] }>
  getPayrollLines(periodId: string): Promise<PayrollLine[]>
  computePayroll(periodId: string): Promise<PayrollPeriod>
  setPeriodStatus(periodId: string, status: PeriodStatus): Promise<PayrollPeriod>

  listAdjustments(): Promise<Adjustment[]>
  saveAdjustment(input: AdjustmentInput): Promise<Adjustment>

  listOvertime(): Promise<OvertimeRequest[]>
  decideOvertime(id: string, status: Exclude<ApprovalStatus, 'pending'>): Promise<OvertimeRequest>

  listLeaves(): Promise<LeaveRecord[]>
  decideLeave(id: string, status: Exclude<ApprovalStatus, 'pending'>): Promise<LeaveRecord>

  listRequests(): Promise<AzoneRequest[]>
  decideRequest(
    id: string,
    status: Exclude<ApprovalStatus, 'pending'>,
    overtime?: { date: string; hours: number; kind: OvertimeKind },
  ): Promise<AzoneRequest>

  listAnnouncements(): Promise<Announcement[]>
  saveAnnouncement(input: AnnouncementInput): Promise<Announcement>

  getSettings(): Promise<PayrollSettings>
  saveSettings(input: PayrollSettings): Promise<PayrollSettings>

  listAudit(): Promise<AuditEntry[]>
}
