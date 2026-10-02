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

/** Who can do what in APAY. Every role can view the dashboard and payroll periods. */
export const rolePermissions: Record<Role, Permission[]> = {
  payroll_admin: [
    'employees.manage',
    'attendance.manage',
    'payroll.process',
    'payroll.release',
    'adjustments.manage',
    'overtime.decide',
    'reports.view',
    'settings.manage',
  ],
  hr: ['employees.manage', 'attendance.manage', 'overtime.decide', 'announcements.manage', 'reports.view'],
  finance: ['payroll.approve', 'payroll.release', 'reports.view'],
  management: ['payroll.approve', 'reports.view'],
}

export const roleLabels: Record<Role, string> = {
  payroll_admin: 'Payroll Admin',
  hr: 'HR',
  finance: 'Finance',
  management: 'Management',
}

export function can(role: Role | undefined, permission: Permission) {
  return !!role && rolePermissions[role].includes(permission)
}
