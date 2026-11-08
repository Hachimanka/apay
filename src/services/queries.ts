import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  AdjustmentInput,
  AnnouncementInput,
  ApprovalStatus,
  AttendanceInput,
  EmployeeInput,
  EmployeeRecordInput,
  FilingInput,
  FinalPay,
  PayEntryInput,
  ReportParams,
  CadetInput,
  CadetStage,
  CrewStintInput,
  DisembarkInput,
  VesselInput,
  SeparationReason,
  Holiday,
  OvertimeKind,
  ShiftInput,
  TimeRecordInput,
  PayrollSettings,
  PeriodStatus,
} from './types'

export const keys = {
  employees: ['employees'] as const,
  employee: (id: string) => ['employees', id] as const,
  employeeRecords: (id: string) => ['employees', id, 'records'] as const,
  periods: ['periods'] as const,
  period: (id: string) => ['periods', id] as const,
  attendance: (id: string) => ['periods', id, 'attendance'] as const,
  lines: (id: string) => ['periods', id, 'lines'] as const,
  adjustments: ['adjustments'] as const,
  overtime: ['overtime'] as const,
  leaves: ['leaves'] as const,
  announcements: ['announcements'] as const,
  settings: ['settings'] as const,
  audit: ['audit'] as const,
  daily: (date: string) => ['daily', date] as const,
  loans: (employeeId?: string) => ['loans', employeeId ?? 'all'] as const,
  payslipEmails: (periodId: string) => ['periods', periodId, 'payslip-emails'] as const,
}

export const useEmployees = () => useQuery({ queryKey: keys.employees, queryFn: api.listEmployees })
export const useEmployee = (id: string) => useQuery({ queryKey: keys.employee(id), queryFn: () => api.getEmployee(id) })
export const usePeriods = () => useQuery({ queryKey: keys.periods, queryFn: api.listPeriods })
export const usePeriod = (id: string) => useQuery({ queryKey: keys.period(id), queryFn: () => api.getPeriod(id), enabled: !!id })
export const useAttendance = (id: string) => useQuery({ queryKey: keys.attendance(id), queryFn: () => api.getAttendance(id), enabled: !!id })
export const usePayrollLines = (id: string) => useQuery({ queryKey: keys.lines(id), queryFn: () => api.getPayrollLines(id), enabled: !!id })
export const useAdjustments = () => useQuery({ queryKey: keys.adjustments, queryFn: api.listAdjustments })
export const useOvertime = () => useQuery({ queryKey: keys.overtime, queryFn: api.listOvertime })
export const useLeaves = () => useQuery({ queryKey: keys.leaves, queryFn: api.listLeaves })
export const useAnnouncements = () => useQuery({ queryKey: keys.announcements, queryFn: api.listAnnouncements })
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: api.getSettings })
export const useAudit = () => useQuery({ queryKey: keys.audit, queryFn: api.listAudit })

function useInvalidate() {
  const qc = useQueryClient()
  return (...k: (readonly unknown[])[]) => Promise.all([...k, keys.audit].map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export function useSaveEmployee() {
  const invalidate = useInvalidate()
  // keys.employees also covers each employee's profile and 201 records (an update may log a movement entry)
  return useMutation({ mutationFn: (input: EmployeeInput & { id: string }) => api.saveEmployee(input), onSuccess: () => invalidate(keys.employees) })
}

export const useEmployeeRecords = (employeeId: string) =>
  useQuery({ queryKey: keys.employeeRecords(employeeId), queryFn: () => api.listEmployeeRecords(employeeId) })

export function useSaveEmployeeRecord() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: EmployeeRecordInput) => api.saveEmployeeRecord(input),
    onSuccess: (r) => invalidate(keys.employeeRecords(r.employeeId)),
  })
}

export function useDeleteEmployeeRecord() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ employeeId, id }: { employeeId: string; id: string }) => api.deleteEmployeeRecord(employeeId, id),
    onSuccess: (_, v) => invalidate(keys.employeeRecords(v.employeeId)),
  })
}

export function useComputePayroll() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (periodId: string) => api.computePayroll(periodId), onSuccess: () => invalidate(keys.periods) })
}

export function useSetPeriodStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ periodId, status }: { periodId: string; status: PeriodStatus }) => api.setPeriodStatus(periodId, status),
    onSuccess: () => invalidate(keys.periods),
  })
}

export function useSaveAdjustment() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: AdjustmentInput) => api.saveAdjustment(input), onSuccess: () => invalidate(keys.adjustments, ['loans']) })
}

export function useDecideOvertime() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<ApprovalStatus, 'pending'> }) => api.decideOvertime(id, status),
    onSuccess: () => invalidate(keys.overtime),
  })
}

export function useSaveAnnouncement() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: AnnouncementInput) => api.saveAnnouncement(input), onSuccess: () => invalidate(keys.announcements) })
}

export function useSaveSettings() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: PayrollSettings) => api.saveSettings(input), onSuccess: () => invalidate(keys.settings) })
}

/* Holiday calendar and shifts change attendance and pay: refresh periods and daily records too */
const scheduleKeys = [['holidays'], ['shifts'], keys.periods, ['daily'], keys.employees] as const

export const useHolidays = () => useQuery({ queryKey: ['holidays'], queryFn: api.listHolidays })
export const useShifts = () => useQuery({ queryKey: ['shifts'], queryFn: api.listShifts })

export function useSaveHoliday() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ input, originalDate }: { input: Holiday; originalDate?: string }) => api.saveHoliday(input, originalDate),
    onSuccess: () => invalidate(...scheduleKeys),
  })
}

export function useDeleteHoliday() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (date: string) => api.deleteHoliday(date), onSuccess: () => invalidate(...scheduleKeys) })
}

export function useLoadOfficialHolidays() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: () => api.loadOfficialHolidays(), onSuccess: () => invalidate(...scheduleKeys) })
}

export function useSaveShift() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: ShiftInput) => api.saveShift(input), onSuccess: () => invalidate(...scheduleKeys) })
}

export function useDeleteShift() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api.deleteShift(id), onSuccess: () => invalidate(...scheduleKeys) })
}

/** Attendance edits can reset a computed payroll to draft, so refresh the whole period (lines, totals, status). */
export function useSaveAttendance() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ periodId, source, rows }: { periodId: string; source: 'manual' | 'upload'; rows: AttendanceInput[] }) =>
      api.saveAttendance(periodId, source, rows),
    onSuccess: () => invalidate(keys.periods),
  })
}

export function useResetAttendance() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ periodId, employeeId }: { periodId: string; employeeId: string }) => api.resetAttendance(periodId, employeeId),
    onSuccess: () => invalidate(keys.periods),
  })
}

export const useDailyAttendance = (date: string) =>
  useQuery({ queryKey: keys.daily(date), queryFn: () => api.getDailyAttendance(date), enabled: !!date })

/** Daily punches feed the cut-off totals and can reset a computed payroll, so refresh periods too. */
export function useSaveTimeRecords() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ source, rows }: { source: 'manual' | 'upload'; rows: TimeRecordInput[] }) => api.saveTimeRecords(source, rows),
    onSuccess: () => invalidate(['daily'], keys.periods),
  })
}

/** Adds an employee and their AZONE login together. */
export function useCreateEmployee() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: EmployeeInput) => api.createEmployee(input), onSuccess: () => invalidate(keys.employees) })
}

/** An employee's AZONE photo. Keyed by its version, so a new photo is fetched once and then served from cache. */
export const useEmployeeAvatar = (id: string, version: string | null | undefined) =>
  useQuery({
    queryKey: ['employees', id, 'avatar', version],
    queryFn: () => api.getEmployeeAvatar(id),
    enabled: !!version,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })

export const useRequests = () => useQuery({ queryKey: ['requests'], queryFn: api.listRequests })

/** Decisions change what payroll pays (leave days, overtime hours), so refresh periods as well. */
export function useDecideLeave() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<ApprovalStatus, 'pending'> }) => api.decideLeave(id, status),
    onSuccess: () => invalidate(keys.leaves, keys.periods),
  })
}

export function useDecideRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      status,
      overtime,
    }: {
      id: string
      status: Exclude<ApprovalStatus, 'pending'>
      overtime?: { date: string; hours: number; kind: OvertimeKind }
    }) => api.decideRequest(id, status, overtime),
    // Approved time filings change the daily time records too
    onSuccess: () => invalidate(['requests'], keys.overtime, keys.periods, ['daily']),
  })
}

export function useDecideRequests() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: Exclude<ApprovalStatus, 'pending'> }) => api.decideRequests(ids, status),
    onSuccess: () => invalidate(['requests'], keys.overtime, keys.periods, ['daily']),
  })
}

/** HR files a discrepancy / no DTR / undertime / official business / overtime for an employee. */
export function useFileRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: FilingInput) => api.fileRequest(input),
    onSuccess: () => invalidate(['requests'], keys.overtime, keys.periods, ['daily']),
  })
}

/* ------------------------------ Phase 2B: special pay ------------------------------ */

export const usePayEntries = (periodId: string) => useQuery({ queryKey: ['periods', periodId, 'entries'], queryFn: () => api.listPayEntries(periodId), enabled: !!periodId })

/** Entries change what the payroll pays, so a computed payroll goes back to draft: refresh periods too */
export function usePayEntryMutations(periodId: string) {
  const invalidate = useInvalidate()
  const done = () => invalidate(['periods', periodId, 'entries'], keys.periods)
  return {
    add: useMutation({ mutationFn: (input: PayEntryInput) => api.addPayEntry(periodId, input), onSuccess: done }),
    remove: useMutation({ mutationFn: (entryId: string) => api.deletePayEntry(periodId, entryId), onSuccess: done }),
    convertVl: useMutation({ mutationFn: (maxDays?: number) => api.convertVacationLeave(periodId, maxDays), onSuccess: done }),
  }
}

export const useThirteenthMonth = (year: string) => useQuery({ queryKey: ['thirteenth-month', year], queryFn: () => api.thirteenthMonth(year) })

/* ------------------------------ Phase 5: shipping ------------------------------ */

export const useVessels = () => useQuery({ queryKey: ['vessels'], queryFn: api.listVessels })
export const useCrew = (filter: { employeeId?: string; aboard?: boolean } = {}) => useQuery({ queryKey: ['crew', filter], queryFn: () => api.listCrew(filter) })
export const useCadets = () => useQuery({ queryKey: ['cadets'], queryFn: api.listCadets })
export const useLicenses = (days = 90) => useQuery({ queryKey: ['licenses', days], queryFn: () => api.listLicenses(days) })

export function useShippingMutations() {
  const invalidate = useInvalidate()
  const crewDone = () => invalidate(['crew'], ['vessels'], ['reports'])
  return {
    saveVessel: useMutation({ mutationFn: (v: VesselInput) => api.saveVessel(v), onSuccess: () => invalidate(['vessels']) }),
    saveStint: useMutation({ mutationFn: (s: CrewStintInput) => api.saveCrewStint(s), onSuccess: crewDone }),
    deleteStint: useMutation({ mutationFn: (id: string) => api.deleteCrewStint(id), onSuccess: crewDone }),
    disembark: useMutation({ mutationFn: ({ id, input }: { id: string; input: DisembarkInput }) => api.disembark(id, input), onSuccess: crewDone }),
    saveCadet: useMutation({ mutationFn: (c: CadetInput) => api.saveCadet(c), onSuccess: () => invalidate(['cadets']) }),
    moveCadet: useMutation({
      mutationFn: ({ id, stage, note }: { id: string; stage: CadetStage; note?: string }) => api.moveCadet(id, stage, note),
      onSuccess: () => invalidate(['cadets']),
    }),
  }
}

export const useReportCatalog = () => useQuery({ queryKey: ['reports'], queryFn: api.listReports, staleTime: Infinity })
export const useReport = (key: string | null, params: ReportParams) =>
  useQuery({ queryKey: ['reports', key, params], queryFn: () => api.runReport(key!, params), enabled: !!key })

export const useFinalPays = () => useQuery({ queryKey: ['final-pays'], queryFn: api.listFinalPays })
export const useFinalPay = (employeeId: string) => useQuery({ queryKey: ['final-pays', employeeId], queryFn: () => api.getFinalPay(employeeId), enabled: !!employeeId })

export function useFinalPayMutations(employeeId: string) {
  const invalidate = useInvalidate()
  const done = () => invalidate(['final-pays'], keys.employees, ['loans'], keys.adjustments)
  return {
    compute: useMutation({
      mutationFn: ({ separationDate, separationReason }: { separationDate: string; separationReason?: SeparationReason }) =>
        api.computeFinalPay(employeeId, separationDate, separationReason),
      onSuccess: done,
    }),
    save: useMutation({ mutationFn: (input: Pick<FinalPay, 'earnings' | 'deductions' | 'clearance'>) => api.saveFinalPay(employeeId, input), onSuccess: done }),
    status: useMutation({ mutationFn: (status: FinalPay['status']) => api.setFinalPayStatus(employeeId, status), onSuccess: done }),
    remove: useMutation({ mutationFn: () => api.deleteFinalPay(employeeId), onSuccess: done }),
  }
}

export const useLoans = (employeeId?: string) => useQuery({ queryKey: keys.loans(employeeId), queryFn: () => api.listLoans(employeeId) })

export const usePayslipEmails = (periodId: string, enabled = true) =>
  useQuery({ queryKey: keys.payslipEmails(periodId), queryFn: () => api.getPayslipEmails(periodId), enabled: !!periodId && enabled })

export function useSendPayslipEmails() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ periodId, employeeIds }: { periodId: string; employeeIds?: string[] }) => api.sendPayslipEmails(periodId, employeeIds),
    onSuccess: (_, v) => invalidate(keys.payslipEmails(v.periodId)),
  })
}
