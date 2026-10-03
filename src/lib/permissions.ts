import type { Role } from '@/services/types'

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

/** APAY is run by the HR department alone, so HR can do everything. Mirrors aznar-api/src/lib/permissions.ts. */
export const rolePermissions: Record<Role, Permission[]> = {
  hr: [
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
  ],
}

export const roleLabels: Record<Role, string> = {
  hr: 'HR',
}

export function can(role: Role | undefined, permission: Permission) {
  return !!role && !!rolePermissions[role]?.includes(permission)
}
