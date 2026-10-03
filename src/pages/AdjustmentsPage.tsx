import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useAdjustments, useEmployees, useSaveAdjustment } from '@/services/queries'
import type { Adjustment, AdjustmentCategory } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { formatPeso } from '@/lib/format'
import { cn } from '@/lib/cn'

const categoryLabel: Record<AdjustmentCategory, string> = {
  de_minimis: 'De minimis (non-taxable)',
  taxable: 'Taxable allowance',
  loan: 'Loan',
  other: 'Other deduction',
}

const filters = ['all', 'allowance', 'deduction'] as const

export function AdjustmentsPage() {
  const { data, isLoading } = useAdjustments()
  const save = useSaveAdjustment()
  const role = useAuth((s) => s.session?.user.role)
  const canManage = can(role, 'adjustments.manage')
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')
  const [open, setOpen] = useState(false)

  const columns: ColumnDef<Adjustment>[] = [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
      cell: ({ getValue }) => <span className="font-semibold text-navy">{getValue<string>()}</span>,
    },
    { accessorKey: 'name', header: 'Item' },
    {
      accessorKey: 'kind',
      header: 'Kind',
      cell: ({ row }) => (
        <Badge size="sm" tone={row.original.kind === 'allowance' ? 'success' : 'danger'}>
          {row.original.kind}
        </Badge>
      ),
    },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => categoryLabel[row.original.category] },
    {
      id: 'amount',
      header: 'Per cut-off',
      meta: { align: 'right' },
      accessorFn: (a) => Number(a.amount),
      cell: ({ row }) => formatPeso(row.original.amount),
    },
    {
      id: 'balance',
      header: 'Balance',
      meta: { align: 'right' },
      accessorFn: (a) => Number(a.balance ?? 0),
      cell: ({ row }) => (row.original.balance ? formatPeso(row.original.balance) : '—'),
    },
    {
      accessorKey: 'active',
      header: 'Active',
      cell: ({ row }) => (
        <button
          role="switch"
          aria-checked={row.original.active}
          disabled={!canManage}
          onClick={() => save.mutate({ ...row.original, active: !row.original.active })}
          className={cn('relative h-5 w-9 rounded-full transition disabled:opacity-50', row.original.active ? 'bg-primary' : 'bg-line')}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
              row.original.active && 'translate-x-4',
            )}
          />
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Payroll"
        title="Allowances & Deductions"
        description="Recurring earnings, loans and other deductions applied on every cut-off."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add item
            </Button>
          )
        }
      />
      <DataTable
        data={data?.filter((a) => filter === 'all' || a.kind === filter)}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search employee or item…"
        toolbar={
          <div className="flex gap-1 rounded-xl bg-bg p-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                  filter === f ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-primary',
                )}
              >
                {f === 'all' ? 'All' : `${f}s`}
              </button>
            ))}
          </div>
        }
      />
      {open && <AdjustmentDialog onClose={() => setOpen(false)} />}
    </>
  )
}

const schema = z.object({
  employeeId: z.string().min(1, 'Choose an employee'),
  kind: z.enum(['allowance', 'deduction']),
  category: z.enum(['de_minimis', 'taxable', 'loan', 'other']),
  name: z.string().trim().min(2, 'Required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount like 1000 or 1000.50'),
  balance: z
    .string()
    .regex(/^(\d+(\.\d{1,2})?)?$/, 'Amount like 15000')
    .optional(),
})

type FormValues = z.infer<typeof schema>

function AdjustmentDialog({ onClose }: { onClose: () => void }) {
  const employees = useEmployees()
  const save = useSaveAdjustment()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { kind: 'allowance', category: 'taxable', employeeId: '' } })
  const kind = watch('kind')

  const onSubmit = handleSubmit(async (v) => {
    await save.mutateAsync({ ...v, amount: Number(v.amount).toFixed(2), balance: v.balance ? Number(v.balance).toFixed(2) : undefined, active: true })
    onClose()
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add allowance or deduction">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Employee" error={errors.employeeId?.message}>
          <Select {...register('employeeId')}>
            <option value="">Select employee…</option>
            {employees.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} · {e.employeeNo}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select {...register('kind')}>
              <option value="allowance">Allowance</option>
              <option value="deduction">Deduction</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select {...register('category')}>
              {(kind === 'allowance' ? (['de_minimis', 'taxable'] as const) : (['loan', 'other'] as const)).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Name" error={errors.name?.message}>
          <Input placeholder={kind === 'allowance' ? 'e.g. Meal Allowance' : 'e.g. SSS Salary Loan'} {...register('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount per cut-off (₱)" error={errors.amount?.message}>
            <Input inputMode="decimal" {...register('amount')} />
          </Field>
          {kind === 'deduction' && (
            <Field label="Loan balance (₱)" error={errors.balance?.message}>
              <Input inputMode="decimal" placeholder="Optional" {...register('balance')} />
            </Field>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Dialog>
  )
}
