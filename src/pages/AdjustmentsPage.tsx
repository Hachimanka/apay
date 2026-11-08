import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HandCoins, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useAdjustments, useEmployees, useSaveAdjustment } from '@/services/queries'
import type { Adjustment, AdjustmentCategory, LoanType } from '@/services/types'
import { LoanLedger, loanTypeLabels } from '@/features/loans/LoanLedger'
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

const filters = ['all', 'allowance', 'deduction', 'loans'] as const

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
      {filter === 'loans' && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <HandCoins className="size-4 text-primary" /> Loan ledger: amount borrowed, balance and every payment deducted from released payslips.
        </div>
      )}
      <DataTable
        data={data?.filter((a) => filter === 'all' || (filter === 'loans' ? a.category === 'loan' : a.kind === filter))}
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
                {f === 'all' ? 'All' : f === 'loans' ? 'Loan ledger' : `${f}s`}
              </button>
            ))}
          </div>
        }
      />
      {filter === 'loans' && <LoanLedger className="mt-5" />}
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
  loanType: z.enum(['sss', 'pagibig', 'company', 'cash_advance', 'other']).optional(),
  principal: z
    .string()
    .regex(/^(\d+(\.\d{1,2})?)?$/, 'Amount like 20000')
    .optional(),
  startDate: z.string().optional(),
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
  const loan = watch('category') === 'loan'

  const onSubmit = handleSubmit(async (v) => {
    const peso = (x?: string) => (x ? Number(x).toFixed(2) : undefined)
    await save.mutateAsync({
      ...v,
      amount: Number(v.amount).toFixed(2),
      balance: peso(v.balance ?? (loan ? v.principal : undefined)),
      loanType: loan ? (v.loanType ?? 'other') : undefined,
      principal: loan ? peso(v.principal) : undefined,
      startDate: loan && v.startDate ? v.startDate : undefined,
      active: true,
    })
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
            <Field label={loan ? 'Balance left (₱)' : 'Balance (₱)'} error={errors.balance?.message}>
              <Input inputMode="decimal" placeholder={loan ? 'Blank = amount borrowed' : 'Optional'} {...register('balance')} />
            </Field>
          )}
        </div>
        {loan && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loan type">
              <Select {...register('loanType')} defaultValue="company">
                {(Object.keys(loanTypeLabels) as LoanType[]).map((t) => (
                  <option key={t} value={t}>
                    {loanTypeLabels[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount borrowed (₱)" error={errors.principal?.message}>
              <Input inputMode="decimal" placeholder="e.g. 20000" {...register('principal')} />
            </Field>
            <Field label="Deductions start">
              <Input type="date" {...register('startDate')} />
            </Field>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Dialog>
  )
}
