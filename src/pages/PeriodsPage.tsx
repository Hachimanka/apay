import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { PeriodStatusBadge } from '@/components/shared/StatusBadges'
import { usePeriods } from '@/services/queries'
import type { PayrollPeriod } from '@/services/types'
import { formatDate, formatPeso } from '@/lib/format'

const money = (key: keyof PayrollPeriod, header: string): ColumnDef<PayrollPeriod> => ({
  accessorFn: (p) => Number(p[key]),
  id: key,
  header,
  meta: { align: 'right' },
  cell: ({ row }) => (row.original.headcount ? formatPeso(row.original[key] as string) : <span className="text-muted">—</span>),
})

const columns: ColumnDef<PayrollPeriod>[] = [
  { accessorKey: 'label', header: 'Cut-off', cell: ({ row }) => <span className="font-semibold text-navy">{row.original.label}</span> },
  { accessorKey: 'payDate', header: 'Pay date', cell: ({ getValue }) => formatDate(getValue<string>()) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <PeriodStatusBadge status={row.original.status} /> },
  { accessorKey: 'headcount', header: 'Employees', meta: { align: 'right' } },
  money('gross', 'Gross'),
  money('deductions', 'Deductions'),
  money('net', 'Net pay'),
]

export function PeriodsPage() {
  const { data, isLoading } = usePeriods()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader eyebrow="Payroll" title="Payroll Periods" description="Semi-monthly cut-offs. Open one to compute, review, approve and release." />
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search cut-offs…"
        onRowClick={(p) => navigate(`/app/periods/${p.id}`)}
      />
    </>
  )
}
