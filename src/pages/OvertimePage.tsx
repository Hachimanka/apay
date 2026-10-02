import type { ColumnDef } from '@tanstack/react-table'
import { Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { ApprovalBadge } from '@/components/shared/StatusBadges'
import { useDecideOvertime, useOvertime } from '@/services/queries'
import type { OvertimeKind, OvertimeRequest } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { OT_MULTIPLIERS } from '@/lib/payroll'
import { formatDate } from '@/lib/format'

export const otKindLabel: Record<OvertimeKind, string> = {
  regular: 'Regular day',
  restDay: 'Rest day',
  specialHoliday: 'Special holiday',
  regularHoliday: 'Regular holiday',
}

export function OvertimePage() {
  const { data, isLoading } = useOvertime()
  const decide = useDecideOvertime()
  const role = useAuth((s) => s.session?.user.role)
  const canDecide = can(role, 'overtime.decide')

  const columns: ColumnDef<OvertimeRequest>[] = [
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
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: 'hours', header: 'Hours', meta: { align: 'right' } },
    {
      accessorKey: 'kind',
      header: 'Type',
      cell: ({ row }) => `${otKindLabel[row.original.kind]} · ${Math.round(Number(OT_MULTIPLIERS[row.original.kind]) * 100)}%`,
    },
    { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => <span className="block max-w-56 truncate">{getValue<string>()}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <ApprovalBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.status === 'pending' && canDecide ? (
          <span className="inline-flex gap-1.5">
            <button
              onClick={() => decide.mutate({ id: row.original.id, status: 'approved' })}
              className="rounded-lg bg-success-50 p-1.5 text-success transition hover:bg-success hover:text-white"
              aria-label="Approve"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={() => decide.mutate({ id: row.original.id, status: 'rejected' })}
              className="rounded-lg bg-danger-50 p-1.5 text-danger transition hover:bg-danger hover:text-white"
              aria-label="Reject"
            >
              <X className="size-4" />
            </button>
          </span>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader eyebrow="Time" title="Overtime" description="Overtime filed in AZONE. Approved hours are paid in the next computed cut-off." />
      <Card className="mb-5 grid grid-cols-2 divide-line p-0 sm:grid-cols-4 sm:divide-x">
        {(Object.keys(OT_MULTIPLIERS) as OvertimeKind[]).map((k) => (
          <div key={k} className="p-4 text-center">
            <p className="text-xs text-muted">{otKindLabel[k]}</p>
            <p className="mt-0.5 text-lg font-bold text-navy">{Math.round(Number(OT_MULTIPLIERS[k]) * 100)}%</p>
          </div>
        ))}
      </Card>
      <DataTable data={data} columns={columns} loading={isLoading} searchPlaceholder="Search employee…" />
    </>
  )
}
