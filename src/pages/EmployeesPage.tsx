import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { EmploymentBadge } from '@/components/shared/StatusBadges'
import { useEmployees, useSaveEmployee } from '@/services/queries'
import type { Employee } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { dailyRate } from '@/lib/payroll'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatPeso } from '@/lib/format'

const departments = ['IT Department', 'HR Department', 'Finance', 'Operations', 'Sales & Marketing', 'Customer Service']

const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: 'fullName',
    header: 'Employee',
    cell: ({ row }) => (
      <span className="flex items-center gap-3">
        <Avatar name={row.original.fullName} className="size-8 text-xs ring-2" />
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
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const canManage = can(role, 'employees.manage')

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="The employee master used for payroll. Profile changes sync to AZONE."
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <UserPlus className="size-4" /> Add employee
            </Button>
          )
        }
      />
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search name, ID, department…"
        onRowClick={canManage ? setEditing : undefined}
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
      {editing && <EmployeeDialog employee={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

const schema = z.object({
  employeeNo: z.string().trim().min(3, 'Required'),
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  email: z.email('Enter a valid email'),
  position: z.string().trim().min(2, 'Required'),
  department: z.string().min(1),
  employmentType: z.enum(['Regular', 'Probationary', 'Contractual']),
  status: z.enum(['active', 'on_leave', 'resigned']),
  monthlyBasic: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount like 25000 or 25000.50'),
  hireDate: z.string().min(1, 'Required'),
  taxStatus: z.enum(['S', 'ME', 'S1', 'ME1', 'ME2']),
})

type FormValues = z.infer<typeof schema>

function EmployeeDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const save = useSaveEmployee()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: employee ?? {
      employeeNo: `AZN-${new Date().getFullYear()}-`,
      department: departments[0],
      employmentType: 'Probationary',
      status: 'active',
      taxStatus: 'S',
      hireDate: new Date().toISOString().slice(0, 10),
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    await save.mutateAsync({
      ...v,
      id: employee?.id,
      monthlyBasic: Number(v.monthlyBasic).toFixed(2),
      bank: employee?.bank ?? { name: 'BDO', account: '—' },
      govIds: employee?.govIds ?? { sss: '—', philhealth: '—', pagibig: '—', tin: '—' },
    })
    onClose()
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={employee ? `Edit ${employee.fullName}` : 'Add employee'}
      description={employee ? `Hired ${formatDate(employee.hireDate)}` : undefined}
    >
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
            {['S', 'ME', 'S1', 'ME1', 'ME2'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hire date" error={errors.hireDate?.message}>
          <Input type="date" {...register('hireDate')} />
        </Field>
        <div className="col-span-2 mt-2">
          {save.isError && <p className="mb-2 text-sm text-danger">{save.error.message}</p>}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
