import {
  BadgePercent,
  CalendarRange,
  ChartColumn,
  Clock,
  FileText,
  Landmark,
  LayoutDashboard,
  Megaphone,
  PlaneTakeoff,
  Settings,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; permission?: Permission }

export const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'People & Time',
    items: [
      { to: '/app/employees', label: 'Employees', icon: Users },
      { to: '/app/attendance', label: 'Attendance & DTR', icon: Clock },
      { to: '/app/overtime', label: 'Overtime', icon: Timer },
      { to: '/app/leave-impact', label: 'Leave Impact', icon: PlaneTakeoff },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/app/periods', label: 'Payroll Periods', icon: CalendarRange },
      { to: '/app/payslips', label: 'Payslips', icon: FileText },
      { to: '/app/adjustments', label: 'Allowances & Deductions', icon: BadgePercent },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/app/government', label: 'Government Deductions', icon: Landmark },
      { to: '/app/reports', label: 'Reports', icon: ChartColumn, permission: 'reports.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/app/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/app/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
    ],
  },
]

export const mobileTabs: NavItem[] = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/periods', label: 'Payroll', icon: CalendarRange },
  { to: '/app/employees', label: 'People', icon: Users },
]
