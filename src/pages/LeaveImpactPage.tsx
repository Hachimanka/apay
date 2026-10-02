import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CircleDollarSign, PlaneTakeoff, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge } from '@/components/ui/Badge'
import { ApprovalBadge } from '@/components/shared/StatusBadges'
import { useEmployees, useLeaves } from '@/services/queries'
import type { LeaveRecord } from '@/services/types'
import { dailyRate, sum } from '@/lib/payroll'
import { formatDate, formatPeso } from '@/lib/format'

type Row = LeaveRecord & { impact: string }

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'employeeName',
    header: 'Employee',
    cell: ({ row }) => (
      <span>
        <span className="block font-semibold text-navy">{row.original.employeeName}</span>
        <span className="block text-xs text-muted">{row.original.department}</span>
      </span>
    ),
  },
  { accessorKey: 'type', header: 'Leave', cell: ({ getValue }) => <span className="capitalize">{getValue<string>()}</span> },
  {
    id: 'dates',
    header: 'Dates',
    accessorFn: (r) => r.start,
    cell: ({ row }) =>
      row.original.start === row.original.end
        ? formatDate(row.original.start)
        : `${formatDate(row.original.start, 'MMM d')} – ${formatDate(row.original.end)}`,
  },
  { accessorKey: 'days', header: 'Days', meta: { align: 'right' } },
  {
    accessorKey: 'paid',
    header: 'Pay',
    cell: ({ row }) => (
      <Badge size="sm" tone={row.original.paid ? 'success' : 'danger'}>
        {row.original.paid ? 'With pay' : 'Without pay'}
      </Badge>
    ),
  },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <ApprovalBadge status={row.original.status} /> },
  {
    id: 'impact',
    header: 'Payroll impact',
    meta: { align: 'right' },
    accessorFn: (r) => Number(r.impact),
    cell: ({ row }) =>
      row.original.paid ? <span className="text-muted">No deduction</span> : <b className="text-danger">-{formatPeso(row.original.impact)}</b>,
  },
]

export function LeaveImpactPage() {
  const leaves = useLeaves()
  const employees = useEmployees()

  const rows = useMemo<Row[]>(
    () =>
      (leaves.data ?? []).map((l) => {
        const emp = employees.data?.find((e) => e.id === l.employeeId)
        const impact = !l.paid && emp ? dailyRate(emp.monthlyBasic).times(l.days).toFixed(2) : '0.00'
        return { ...l, impact }
      }),
    [leaves.data, employees.data],
  )

  const approved = rows.filter((r) => r.status === 'approved')
  const stats = [
    { icon: PlaneTakeoff, label: 'Approved leave days', value: String(approved.reduce((s, r) => s + r.days, 0)) },
    { icon: Wallet, label: 'Days without pay', value: String(approved.filter((r) => !r.paid).reduce((s, r) => s + r.days, 0)) },
    { icon: CircleDollarSign, label: 'Unpaid leave deductions', value: formatPeso(sum(approved.map((r) => r.impact))) },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Leave Impact"
        description="How approved leaves affect pay. Leaves without pay are deducted at the employee’s daily rate."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3 sm:gap-5">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} />
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-bold text-navy">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <DataTable data={rows} columns={columns} loading={leaves.isLoading || employees.isLoading} searchPlaceholder="Search employee…" />
    </>
  )
}
