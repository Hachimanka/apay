/**
 * APAY ↔ aznar-api contract.
 * Money is always a decimal string (e.g. "24500.00") — never a float. Dates are ISO strings.
 */
import type { CutoffResult, Money, OvertimeKind } from '@/lib/payroll'

export type { Money, OvertimeKind }

/** Staff roles. HR can do everything; the others get only what HR grants in Settings → Access rights. */
export type Role = 'hr' | 'payroll_admin' | 'finance' | 'management'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  title: string
  /** What this account may do (from the API's access-rights matrix) */
  permissions?: import('@/lib/permissions').Permission[]
}

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
  middleName?: string
  /** How the rate is quoted (payroll still computes from monthlyBasic) */
  payBasis?: PayBasis
  /** Job level / rank */
  level?: string
  /** Assigned shift; null/absent = company default */
  shiftId?: string | null
}

export type HolidayType = 'regular' | 'special'
export type Holiday = { date: string; name: string; type: HolidayType }

/** A shift code. Minutes after midnight; end < start runs past midnight. restDays: 0 = Sunday … 6 = Saturday. */
export type Shift = {
  id: string
  code: string
  name: string
  startMinutes: number
  endMinutes: number
  breakMinutes: number
  restDays: number[]
  active: boolean
  /** Active employees assigned */
  employees: number
}

export type ShiftInput = Omit<Shift, 'id' | 'employees'> & { id?: string }

export type PayBasis = 'monthly' | 'daily'
export type Gender = '' | 'male' | 'female'
export type CivilStatus = '' | 'single' | 'married' | 'widowed' | 'separated' | 'annulled'

/** One employee plus what they keep up to date in their AZONE profile. */
export type EmployeeProfile = Employee & {
  phone: string
  /** Present address (the employee can also update it in AZONE) */
  address: string
  birthday: string
  manager: string
  workSchedule: string
  emergencyContact: { name: string; relation: string; phone: string }
  gender: Gender
  civilStatus: CivilStatus
  permanentAddress: string
  spouseName: string
  skills: string[]
  /** Set once a final pay is started */
  separationDate?: string
  separationReason?: string
  /** AZONE profile photo as a data URL, or null */
  avatarUrl: string | null
}

/** HRIS profile fields HR can edit; omitted ones are left unchanged by the API. */
export type EmployeeProfileInput = Partial<
  Pick<EmployeeProfile, 'gender' | 'civilStatus' | 'address' | 'permanentAddress' | 'birthday' | 'spouseName' | 'skills'>
>

export type EmployeeInput = Omit<Employee, 'id' | 'fullName' | 'avatarVersion'> &
  EmployeeProfileInput & {
    id?: string
    /** Hiring from applicant tracking: links the application to the new 201 file */
    applicantId?: string
  }

/** Repeating parts of the 201 file. */
export type EmployeeRecordKind =
  | 'child'
  | 'education'
  | 'employment_history'
  | 'training'
  | 'certification'
  | 'medical'
  | 'appraisal'
  | 'disciplinary'
  | 'asset'
  | 'movement'

export type RecordValue = string | number | null

export type EmployeeRecord = {
  id: string
  employeeId: string
  kind: EmployeeRecordKind
  data: Record<string, RecordValue>
  /** Logged automatically (movement from employee changes, hire) — read-only */
  auto: boolean
  createdAt: string
  updatedAt: string
}

export type EmployeeRecordInput = { id?: string; employeeId: string; kind: EmployeeRecordKind; data: Record<string, RecordValue> }

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
  /** Where each AZONE punch was made (geo-tagging), when recorded */
  geo?: Partial<Record<'timeIn' | 'breakOut' | 'breakIn' | 'timeOut', import('./platform').GeoPoint>> | null
  status: DailyStatus
  lateMinutes: number
  /** Minutes left before the shift end (deducted with lates) */
  undertimeMinutes?: number
  /** Covered by approved official business: counts as present, no late or undertime */
  officialBusiness?: boolean
  hoursWorked: number
  /** HR set this employee's cut-off totals directly, so daily changes won't affect their pay until that is reset */
  cutoffOverridden: boolean
  /** The employee's shift code and regular punches (for "fill blanks") */
  shiftCode?: string
  shift?: Punches
  /** Hours worked 10 PM – 6 AM this day */
  nightHours?: number
}

export type DailyAttendance = {
  date: string
  holiday: boolean
  holidayType?: HolidayType | null
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
  /** 13th month, bonuses, leave conversion and other one-time earnings (older payslips don't have them) */
  extraItems?: { label: string; amount: Money; kind?: PayEntryKind; exempt?: Money; days?: number }[]
  deductionItems?: { label: string; amount: Money }[]
}

export type PayEntryKind = 'thirteenth_month' | 'bonus' | 'leave_conversion' | 'other_taxable' | 'other_non_taxable' | 'deduction'

/** A one-time entry on one payroll (bonus, VL conversion, other earning or deduction) */
export type PayEntry = {
  id: string
  employeeId: string
  employeeName: string
  department: string
  kind: PayEntryKind
  kindLabel: string
  label: string
  amount: Money
  days?: number
}

export type PayEntryInput = { employeeId: string; kind: PayEntryKind; label?: string; amount?: Money; days?: number }

export type ThirteenthMonthRow = {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  status: Employee['status']
  cutoffs: number
  basicEarned: Money
  accrued: Money
  paid: Money
  due: Money
}

/* ----------------------------- Phase 5: shipping ----------------------------- */

export type VesselType = 'roro' | 'passenger' | 'cargo' | 'container' | 'tanker' | 'bulk' | 'tug' | 'other'
export type Vessel = {
  id: string
  name: string
  imoNo: string
  type: VesselType
  flag: string
  grossTonnage: number | null
  homePort: string
  complement: number | null
  status: 'active' | 'drydock' | 'laid_up' | 'sold'
  notes: string
  /** Crew aboard now */
  aboard: number
}
export type VesselInput = Omit<Vessel, 'id' | 'aboard'> & { id?: string }

export type DisembarkReason = 'end_of_contract' | 'transfer' | 'vacation' | 'medical' | 'emergency' | 'termination' | 'other'
/** One stint aboard (embarkation to disembarkation) */
export type CrewStint = {
  id: string
  employeeId: string
  employeeName?: string
  employeeNo?: string
  vesselId: string
  vesselName?: string
  rank: string
  embarkDate: string
  embarkPort: string
  disembarkDate?: string
  disembarkPort: string
  disembarkReason?: DisembarkReason
  remarks: string
  days: number
  aboard: boolean
}
export type CrewStintInput = {
  id?: string
  employeeId: string
  vesselId: string
  rank: string
  embarkDate: string
  embarkPort: string
  disembarkDate: string | null
  disembarkPort: string
  disembarkReason: DisembarkReason | null
  remarks: string
}
export type DisembarkInput = { date: string; port: string; reason: DisembarkReason; remarks?: string; transferTo?: { vesselId: string; rank?: string } }

export type CadetStage = 'applicant' | 'screening' | 'accepted' | 'onboard' | 'completed' | 'hired' | 'dropped'
export type Cadet = {
  id: string
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  birthday: string | null
  school: string
  course: 'bsmt' | 'bsmare' | 'other'
  batch: string
  stage: CadetStage
  stageHistory: { stage: CadetStage; date: string; note: string; by: string }[]
  vesselId: string | null
  vesselName?: string
  embarkDate: string | null
  disembarkDate: string | null
  requiredSeaDays: number
  evaluation: string
  employeeId: string | null
  remarks: string
  seaDays: number
  seaProgress: number
}
export type CadetInput = Omit<Cadet, 'id' | 'stage' | 'stageHistory' | 'vesselName' | 'seaDays' | 'seaProgress'> & { id?: string }

export type License = {
  recordId: string
  employeeId: string
  employeeName: string
  department: string
  name: string
  number: string
  issuedBy: string
  expiryDate: string
  daysLeft: number
  state: 'expired' | 'expiring' | 'valid'
}

/** Phase 4 reports: every report has the same shape (see aznar-api services/reports.ts) */
export type ReportColumn = { key: string; label: string; type?: 'text' | 'number' | 'money' | 'date' | 'percent' }
export type ReportCell = string | number | null
export type Report = {
  key: string
  title: string
  description: string
  columns: ReportColumn[]
  rows: Record<string, ReportCell>[]
  totals?: Record<string, ReportCell>
  notes?: string[]
}
export type ReportParam = 'year' | 'month' | 'from' | 'to'
export type ReportInfo = { key: string; group: string; params: ReportParam[] }
export type ReportParams = Partial<Record<ReportParam, string>>

export type FinalPayItem = { key: string; label: string; amount: Money; note?: string; included: boolean }
export type ClearanceItem = { key: string; label: string; done: boolean; note?: string }
export type SeparationReason = 'resignation' | 'end_of_contract' | 'termination' | 'retirement' | 'redundancy' | 'death' | 'other'

export type FinalPay = {
  id: string
  employeeId: string
  employeeName?: string
  department?: string
  separationDate: string
  status: 'draft' | 'approved' | 'released'
  earnings: FinalPayItem[]
  deductions: FinalPayItem[]
  clearance: ClearanceItem[]
  basis: Record<string, string | number>
  netPay: Money
  approvedBy?: string
  releasedAt?: string
  updatedAt: string
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
  /** Loans only: type, amount borrowed and when deductions started */
  loanType?: LoanType
  principal?: Money
  startDate?: string
  active: boolean
}

export type LoanType = 'sss' | 'pagibig' | 'company' | 'cash_advance' | 'other'

/** A loan with its payments from released payslips (newest first). */
export type Loan = {
  id: string
  employeeId: string
  employeeName: string
  name: string
  loanType: LoanType
  typeLabel: string
  principal?: Money
  /** Deducted every cut-off */
  amortization: Money
  balance?: Money
  totalPaid: Money
  startDate?: string
  active: boolean
  payments: { periodId: string; period: string; payDate: string; amount: Money }[]
}

export type PayslipEmail = {
  id: string
  employeeId: string
  employeeName: string
  email: string
  /** not_configured = no email server set up, so nothing went out */
  status: 'sent' | 'failed' | 'not_configured'
  error?: string
  sentAt: string
  /** Empty for the automatic email on release */
  sentBy?: string
}

export type PayslipEmailCounts = { sent: number; failed: number; notConfigured: number }

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
  /** Structured fields of a time filing (null for free-text requests) — see FilingData */
  data?: Record<string, unknown> | null
  startDate?: string
  endDate?: string
  /** HR filed it on the employee's behalf */
  filedByHr?: boolean
}

/** Time filings (checklist #73–77); approving one changes the time records or pay. */
export type FilingKind = 'dtr_discrepancy' | 'no_dtr' | 'undertime' | 'official_business' | 'overtime'

export type FilingInput = { employeeId: string; kind: FilingKind; details: string; data: Record<string, unknown>; approve: boolean }

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
  /** Email each employee a link to their payslip (never amounts) when a payroll is released */
  emailPayslips?: boolean
  /** Add the 13th month to the December 16–31 payroll automatically */
  thirteenthMonthAuto?: boolean
  /** Company default shift start, minutes after midnight (employees without a shift code) */
  shiftStartMinutes?: number
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
  listEmployeeRecords(employeeId: string): Promise<EmployeeRecord[]>
  saveEmployeeRecord(input: EmployeeRecordInput): Promise<EmployeeRecord>
  deleteEmployeeRecord(employeeId: string, id: string): Promise<void>

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
  /** Approve or reject several at once; each succeeds or fails on its own */
  decideRequests(ids: string[], status: Exclude<ApprovalStatus, 'pending'>): Promise<{ results: { id: string; ok: boolean; error?: string }[] }>
  /** HR files a time filing on an employee's behalf (optionally approving it at once) */
  fileRequest(input: FilingInput): Promise<AzoneRequest>

  /** All loans, or one employee's */
  listLoans(employeeId?: string): Promise<Loan[]>

  listPayEntries(periodId: string): Promise<PayEntry[]>
  addPayEntry(periodId: string, input: PayEntryInput): Promise<PayEntry[]>
  deletePayEntry(periodId: string, entryId: string): Promise<PayEntry[]>
  /** Convert unused vacation leave to cash on this payroll; `maxDays` caps it per employee */
  convertVacationLeave(periodId: string, maxDays?: number): Promise<{ added: number; entries: PayEntry[] }>
  thirteenthMonth(year: string): Promise<ThirteenthMonthRow[]>

  listFinalPays(): Promise<FinalPay[]>

  listReports(): Promise<ReportInfo[]>

  listVessels(): Promise<Vessel[]>
  saveVessel(input: VesselInput): Promise<Vessel>
  /** All stints, or one employee's sea service; `aboard` = only those aboard now */
  listCrew(filter?: { employeeId?: string; aboard?: boolean }): Promise<CrewStint[]>
  saveCrewStint(input: CrewStintInput): Promise<CrewStint>
  deleteCrewStint(id: string): Promise<void>
  disembark(id: string, input: DisembarkInput): Promise<{ closed: CrewStint; next?: CrewStint }>
  listCadets(): Promise<Cadet[]>
  saveCadet(input: CadetInput): Promise<Cadet>
  moveCadet(id: string, stage: CadetStage, note?: string): Promise<Cadet>
  /** Expired and expiring licenses (within `days`) */
  listLicenses(days?: number): Promise<License[]>
  runReport(key: string, params: ReportParams): Promise<Report>
  getFinalPay(employeeId: string): Promise<FinalPay | null>
  /** Start or recompute (draft only) */
  computeFinalPay(employeeId: string, separationDate: string, separationReason?: SeparationReason): Promise<FinalPay>
  saveFinalPay(employeeId: string, input: Pick<FinalPay, 'earnings' | 'deductions' | 'clearance'>): Promise<FinalPay>
  setFinalPayStatus(employeeId: string, status: FinalPay['status']): Promise<FinalPay>
  deleteFinalPay(employeeId: string): Promise<void>

  getPayslipEmails(periodId: string): Promise<{ configured: boolean; log: PayslipEmail[] }>
  /** Resend to everyone on a released payroll, or to the listed employees */
  sendPayslipEmails(periodId: string, employeeIds?: string[]): Promise<PayslipEmailCounts>

  listAnnouncements(): Promise<Announcement[]>
  saveAnnouncement(input: AnnouncementInput): Promise<Announcement>

  listHolidays(): Promise<Holiday[]>
  /** `originalDate` set = edit that holiday */
  saveHoliday(input: Holiday, originalDate?: string): Promise<Holiday>
  deleteHoliday(date: string): Promise<void>
  /** Add the proclaimed nationwide holidays APAY ships with; returns how many were added */
  loadOfficialHolidays(): Promise<{ added: number }>

  listShifts(): Promise<Shift[]>
  saveShift(input: ShiftInput): Promise<Shift>
  deleteShift(id: string): Promise<void>

  getSettings(): Promise<PayrollSettings>
  saveSettings(input: PayrollSettings): Promise<PayrollSettings>

  listAudit(): Promise<AuditEntry[]>
}
