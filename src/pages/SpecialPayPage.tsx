import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, Gift, UserMinus, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { useFinalPays, useThirteenthMonth } from '@/services/queries'
import type { FinalPay, ThirteenthMonthRow } from '@/services/types'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatPeso } from '@/lib/format'
import { sum } from '@/lib/payroll'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'

const thisYear = Number(manilaToday().slice(0, 4))

/** 13th month (checklist #41) and clearance & final pay (#36) in one place. */
export function SpecialPayPage() {
  const [tab, setTab] = useState<'thirteenth' | 'final'>('thirteenth')
  return (
    <>
      <PageHeader
        eyebrow="Payroll"
        title="13th Month & Final Pay"
        description="The 13th month accrued per employee (paid automatically with the December 16–31 payroll) and the final pay of employees who are leaving."
      />
      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1 shadow-card sm:inline-flex">
        {(
          [
            ['thirteenth', '13th month'],
            ['final', 'Final pay'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
              tab === id ? 'bg-primary text-white' : 'text-ink hover:bg-primary-50 hover:text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'thirteenth' ? <ThirteenthMonth /> : <FinalPays />}
    </>
  )
}

function ThirteenthMonth() {
  const [year, setYear] = useState(String(thisYear))
  const { data, isLoading } = useThirteenthMonth(year)
  const rows = data ?? []
  const stats = [
    { icon: Gift, tone: 'primary' as const, label: 'Accrued so far', value: formatPeso(sum(rows.map((r) => r.accrued))) },
    { icon: Wallet, tone: 'success' as const, label: 'Already paid', value: formatPeso(sum(rows.map((r) => r.paid))) },
    { icon: Gift, tone: 'warning' as const, label: 'Still due', value: formatPeso(sum(rows.map((r) => r.due))) },
  ]
  const columns: ColumnDef<ThirteenthMonthRow>[] = [
    {
      accessorKey: 'name',
      header: 'Employee',
      cell: ({ row }) => (
        <Link to={`/app/employees/${row.original.employeeId}`} className="block">
          <span className="block font-semibold text-navy hover:text-primary">{row.original.name}</span>
          <span className="block text-xs text-muted">
            {row.original.employeeNo} · {row.original.department}
            {row.original.status === 'resigned' && ' · resigned'}
          </span>
        </Link>
      ),
    },
    { accessorKey: 'cutoffs', header: 'Cut-offs', meta: { align: 'right' } },
    { id: 'basic', header: 'Basic earned', meta: { align: 'right' }, accessorFn: (r) => Number(r.basicEarned), cell: ({ row }) => formatPeso(row.original.basicEarned) },
    { id: 'accrued', header: '13th month (÷ 12)', meta: { align: 'right' }, accessorFn: (r) => Number(r.accrued), cell: ({ row }) => formatPeso(row.original.accrued) },
    { id: 'paid', header: 'Paid', meta: { align: 'right' }, accessorFn: (r) => Number(r.paid), cell: ({ row }) => formatPeso(row.original.paid) },
    {
      id: 'due',
      header: 'Due',
      meta: { align: 'right' },
      accessorFn: (r) => Number(r.due),
      cell: ({ row }) => <span className="font-semibold text-navy">{formatPeso(row.original.due)}</span>,
    },
  ]
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3 sm:gap-5">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-bold text-navy">{isLoading ? '—' : s.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted">
        13th month = basic salary actually earned in the year (after absences and lates) ÷ 12, from computed payslips. Tax-exempt up to ₱90,000
        together with bonuses.
      </p>
      <DataTable
        data={rows}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search employee…"
        toolbar={
          <div className="flex gap-2">
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-auto py-2" aria-label="Year">
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button
              variant="soft"
              size="sm"
              disabled={!rows.length}
              onClick={() =>
                downloadCsv(
                  `13th-month-${year}.csv`,
                  rows.map((r) => ({
                    'Employee No': r.employeeNo,
                    Name: r.name,
                    Department: r.department,
                    'Basic Earned': r.basicEarned,
                    '13th Month': r.accrued,
                    Paid: r.paid,
                    Due: r.due,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
          </div>
        }
      />
    </>
  )
}

const statusTone = { draft: 'warning', approved: 'primary', released: 'success' } as const

function FinalPays() {
  const { data, isLoading } = useFinalPays()
  const columns: ColumnDef<FinalPay>[] = [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
      cell: ({ row }) => (
        <Link to={`/app/employees/${row.original.employeeId}?tab=final-pay`} className="block">
          <span className="block font-semibold text-navy hover:text-primary">{row.original.employeeName}</span>
          <span className="block text-xs text-muted">{row.original.department}</span>
        </Link>
      ),
    },
    { accessorKey: 'separationDate', header: 'Last day', cell: ({ getValue }) => formatDate(getValue<string>()) },
    {
      id: 'clearance',
      header: 'Clearance',
      accessorFn: (f) => f.clearance.filter((c) => c.done).length / Math.max(1, f.clearance.length),
      cell: ({ row }) => `${row.original.clearance.filter((c) => c.done).length} / ${row.original.clearance.length}`,
    },
    {
      id: 'net',
      header: 'Net final pay',
      meta: { align: 'right' },
      accessorFn: (f) => Number(f.netPay),
      cell: ({ row }) => <span className="font-semibold text-navy">{formatPeso(row.original.netPay)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge size="sm" tone={statusTone[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
    },
  ]
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted">
        <UserMinus className="size-4 text-primary" /> Start a final pay from the employee’s page → Final pay tab.
      </p>
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search employee…"
        empty={<div className="py-12 text-center text-sm text-muted">No final pays yet.</div>}
      />
    </>
  )
}
