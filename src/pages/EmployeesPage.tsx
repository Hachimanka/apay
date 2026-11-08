import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { EmploymentBadge } from '@/components/shared/StatusBadges'
import { PasswordResetRequests } from '@/components/shared/PasswordResetRequests'
import { useEmployees } from '@/services/queries'
import type { Employee } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { dailyRate } from '@/lib/payroll'
import { downloadCsv } from '@/lib/csv'
import { formatPeso } from '@/lib/format'

const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: 'fullName',
    header: 'Employee',
    cell: ({ row }) => (
      <span className="flex items-center gap-3">
        <EmployeeAvatar employee={row.original} className="size-8 text-xs ring-2" />
        <span>
          <span className="block font-semibold text-navy">{row.original.fullName}</span>
          <span className="block text-xs text-muted">{row.original.employeeNo}</span>
        </span>
      </span>
    ),
  },
  { accessorKey: 'position', header: 'Position' },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'employmentType', header: 'Type' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <EmploymentBadge status={row.original.status} /> },
  {
    id: 'basic',
    header: 'Monthly basic',
    accessorFn: (e) => Number(e.monthlyBasic),
    meta: { align: 'right' },
    cell: ({ row }) => formatPeso(row.original.monthlyBasic),
  },
  {
    id: 'daily',
    header: 'Daily rate',
    accessorFn: (e) => Number(e.monthlyBasic),
    meta: { align: 'right' },
    cell: ({ row }) => formatPeso(dailyRate(row.original.monthlyBasic).toFixed(2)),
  },
]

export function EmployeesPage() {
  const { data, isLoading } = useEmployees()
  const role = useAuth((s) => s.session?.user.role)
  const canManage = can(role, 'employees.manage')
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="The employee master used for payroll. Profile changes sync to AZONE."
        actions={
          canManage && (
            <Button onClick={() => navigate('/app/employees/new')}>
              <UserPlus className="size-4" /> Add employee
            </Button>
          )
        }
      />
      {canManage && <PasswordResetRequests />}
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search name, ID, department…"
        onRowClick={(e) => navigate(`/app/employees/${e.id}`)}
        toolbar={
          <Button
            variant="soft"
            size="sm"
            onClick={() =>
              downloadCsv(
                'employees.csv',
                (data ?? []).map((e) => ({
                  'Employee No': e.employeeNo,
                  Name: e.fullName,
                  Position: e.position,
                  Department: e.department,
                  Type: e.employmentType,
                  Status: e.status,
                  'Monthly Basic': e.monthlyBasic,
                  'Hire Date': e.hireDate,
                })),
              )
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />
    </>
  )
}
