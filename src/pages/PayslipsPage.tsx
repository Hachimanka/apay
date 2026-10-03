import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PeriodSelect } from '@/components/shared/PeriodSelect'
import { PayslipView } from '@/components/shared/PayslipView'
import { usePayrollLines, usePeriod } from '@/services/queries'
import type { PayrollLine } from '@/services/types'
import { formatPeso } from '@/lib/format'

const columns: ColumnDef<PayrollLine>[] = [
  {
    accessorKey: 'name',
    header: 'Employee',
    cell: ({ row }) => (
      <span>
        <span className="block font-semibold text-navy">{row.original.name}</span>
        <span className="block text-xs text-muted">{row.original.employeeNo}</span>
      </span>
    ),
  },
  { accessorKey: 'department', header: 'Department' },
  {
    id: 'gross',
    header: 'Gross',
    meta: { align: 'right' },
    accessorFn: (l) => Number(l.grossPay),
    cell: ({ row }) => formatPeso(row.original.grossPay),
  },
  {
    id: 'ded',
    header: 'Deductions',
    meta: { align: 'right' },
    accessorFn: (l) => Number(l.totalDeductions),
    cell: ({ row }) => formatPeso(row.original.totalDeductions),
  },
  {
    id: 'net',
    header: 'Net pay',
    meta: { align: 'right' },
    accessorFn: (l) => Number(l.netPay),
    cell: ({ row }) => <b className="text-navy">{formatPeso(row.original.netPay)}</b>,
  },
  { id: 'view', header: '', enableSorting: false, meta: { align: 'right' }, cell: () => <Eye className="ml-auto size-4 text-muted" /> },
]

export function PayslipsPage() {
  const [periodId, setPeriodId] = useState('')
  const period = usePeriod(periodId)
  const lines = usePayrollLines(periodId)
  const [preview, setPreview] = useState<PayrollLine | null>(null)
  const released = period.data?.status === 'released'

  return (
    <>
      <PageHeader
        eyebrow="Payroll"
        title="Payslips"
        description="Every payslip generated per cut-off. Released payslips are visible to employees in AZONE."
        actions={<PeriodSelect value={periodId} onChange={setPeriodId} onlyComputed />}
      />
      {period.data && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <Send className="size-5 text-primary" />
          <p className="flex-1 text-sm text-ink">
            {released ? (
              <>
                Published to AZONE on <b>{period.data.releasedAt?.slice(0, 10)}</b> for {period.data.headcount} employees.
              </>
            ) : (
              'These payslips are not yet visible to employees. Release the payroll period to publish them.'
            )}
          </p>
          <Badge tone={released ? 'success' : 'warning'} size="sm">
            {released ? 'Published' : 'Not published'}
          </Badge>
        </div>
      )}
      <DataTable
        data={lines.data}
        columns={columns}
        loading={lines.isLoading || !periodId}
        searchPlaceholder="Search employee…"
        onRowClick={setPreview}
      />
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Payslip">
        {preview && period.data && (
          <>
            <PayslipView line={preview} period={period.data} />
            <Button variant="soft" className="mt-4 w-full" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </>
        )}
      </Dialog>
    </>
  )
}
