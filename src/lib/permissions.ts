import type { Role } from '@/services/types'
import { useAuth } from '@/store/auth'

export type Permission =
  | 'employees.manage'
  | 'attendance.manage'
  | 'payroll.process'
  | 'payroll.approve'
  | 'payroll.release'
  | 'adjustments.manage'
  | 'overtime.decide'
  | 'reports.view'
  | 'announcements.manage'
  | 'settings.manage'

export const allPermissions: Permission[] = [
  'employees.manage',
  'attendance.manage',
  'payroll.process',
  'payroll.approve',
  'payroll.release',
  'adjustments.manage',
  'overtime.decide',
  'reports.view',
  'announcements.manage',
  'settings.manage',
]

export const permissionLabels: Record<Permission, string> = {
  'employees.manage': 'Manage employees & applicants',
  'attendance.manage': 'Manage attendance',
  'payroll.process': 'Compute payroll',
  'payroll.approve': 'Approve payroll',
  'payroll.release': 'Release payroll',
  'adjustments.manage': 'Manage allowances & deductions',
  'overtime.decide': 'Approve overtime & filings',
  'reports.view': 'View reports',
  'announcements.manage': 'Post announcements',
  'settings.manage': 'Change settings',
}

/** HR has every permission; kept for screens that list what HR can do. */
export const rolePermissions: Record<'hr', Permission[]> = { hr: allPermissions }

export const roleLabels: Record<Role, string> = {
  hr: 'HR',
  payroll_admin: 'Payroll Admin',
  finance: 'Finance',
  management: 'Management',
}

/**
 * Mirrors aznar-api/src/lib/permissions.ts — the API is the authority, the UI only hides buttons.
 * HR can do everything; other roles follow the permissions the API sent for the signed-in account.
 */
export function can(role: Role | undefined, permission: Permission) {
  if (!role) return false
  if (role === 'hr') return true
  const user = useAuth.getState().session?.user
  return user?.role === role && !!user.permissions?.includes(permission)
}
