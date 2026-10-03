import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { AdjustmentInput, AnnouncementInput, ApprovalStatus, AttendanceInput, EmployeeInput, PayrollSettings, PeriodStatus } from './types'

export const keys = {
  employees: ['employees'] as const,
  employee: (id: string) => ['employees', id] as const,
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
  return useMutation({ mutationFn: (input: EmployeeInput) => api.saveEmployee(input), onSuccess: () => invalidate(keys.employees) })
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
  return useMutation({ mutationFn: (input: AdjustmentInput) => api.saveAdjustment(input), onSuccess: () => invalidate(keys.adjustments) })
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
