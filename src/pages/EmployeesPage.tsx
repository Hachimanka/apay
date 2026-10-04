import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Download, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { EmploymentBadge } from '@/components/shared/StatusBadges'
import { PasswordResetRequests } from '@/components/shared/PasswordResetRequests'
import { useEmployees, useSaveEmployee } from '@/services/queries'
import type { Employee } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { dailyRate } from '@/lib/payroll'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatPeso } from '@/lib/format'
import { departments, employeeSchema, taxStatusLabels, taxStatusOptions, type EmployeeFormValues } from '@/features/employees/employeeForm'

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

/** Edit an existing employee. (New employees are added on their own page, which also creates the AZONE account.) */
export function EmployeeDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const save = useSaveEmployee()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee,
  })

  const onSubmit = handleSubmit(async (v) => {
    await save.mutateAsync({
      ...v,
      id: employee.id,
      monthlyBasic: Number(v.monthlyBasic).toFixed(2),
      bank: employee.bank,
      govIds: employee.govIds,
    })
    onClose()
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit ${employee.fullName}`} description={`Hired ${formatDate(employee.hireDate)}`}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Field label="Employee No." error={errors.employeeNo?.message}>
          <Input {...register('employeeNo')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="First name" error={errors.firstName?.message}>
          <Input {...register('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
        <Field label="Position" error={errors.position?.message}>
          <Input {...register('position')} />
        </Field>
        <Field label="Department">
          <Select {...register('department')}>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employment type">
          <Select {...register('employmentType')}>
            <option>Regular</option>
            <option>Probationary</option>
            <option>Contractual</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select {...register('status')}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="resigned">Resigned</option>
          </Select>
        </Field>
        <Field label="Monthly basic (₱)" error={errors.monthlyBasic?.message}>
          <Input inputMode="decimal" {...register('monthlyBasic')} />
        </Field>
        <Field label="Tax status">
          <Select {...register('taxStatus')}>
            {taxStatusOptions(employee.taxStatus).map((t) => (
              <option key={t} value={t}>
                {taxStatusLabels[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hire date" error={errors.hireDate?.message}>
          <Input type="date" {...register('hireDate')} />
        </Field>
        <div className="col-span-2 mt-2">
          {save.isError && <p className="mb-2 text-sm text-danger">{save.error.message}</p>}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
