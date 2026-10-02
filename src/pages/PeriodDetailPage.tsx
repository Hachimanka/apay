import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Calculator, CheckCircle2, Download, RotateCcw, Send, ShieldCheck, Undo2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { DataTable } from '@/components/ui/DataTable'
import { Skeleton } from '@/components/ui/Misc'
import { PayrollStepper } from '@/components/shared/PayrollStepper'
import { PeriodStatusBadge } from '@/components/shared/StatusBadges'
import { PayslipView } from '@/components/shared/PayslipView'
import { useAttendance, useComputePayroll, usePayrollLines, usePeriod, useSetPeriodStatus } from '@/services/queries'
import type { AttendanceRow, PayrollLine, PeriodStatus } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatPeso } from '@/lib/format'
import { sum } from '@/lib/payroll'
import { cn } from '@/lib/cn'

const peso = (key: keyof PayrollLine, header: string): ColumnDef<PayrollLine> => ({
  id: key,
  header,
  accessorFn: (l) => Number(l[key]),
  meta: { align: 'right' },
  cell: ({ row }) => formatPeso(row.original[key] as string),
})

const registerColumns: ColumnDef<PayrollLine>[] = [
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
  peso('basicPay', 'Basic'),
  peso('overtimePay', 'Overtime'),
  peso('allowances', 'Allowances'),
  {
    id: 'lessTime',
    header: 'Absent / Late',
    meta: { align: 'right' },
    accessorFn: (l) => Number(l.absencesDeduction) + Number(l.lateDeduction),
    cell: ({ row }) => formatPeso(sum([row.original.absencesDeduction, row.original.lateDeduction])),
  },
  peso('grossPay', 'Gross'),
  peso('sss', 'SSS'),
  peso('philhealth', 'PhilHealth'),
  peso('pagibig', 'Pag-IBIG'),
  peso('withholdingTax', 'Tax'),
  peso('otherDeductions', 'Loans/Other'),
  { ...peso('netPay', 'Net pay'), cell: ({ row }) => <b className="text-navy">{formatPeso(row.original.netPay)}</b> },
]

const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  { accessorKey: 'name', header: 'Employee', cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span> },
  { accessorKey: 'department', header: 'Department' },
  {
    accessorKey: 'daysPresent',
    header: 'Present',
    meta: { align: 'right' },
    cell: ({ row }) => `${row.original.daysPresent} / ${row.original.workingDays}`,
  },
  { accessorKey: 'absentDays', header: 'Absent', meta: { align: 'right' } },
  { accessorKey: 'lateMinutes', header: 'Late (min)', meta: { align: 'right' } },
  { accessorKey: 'overtimeHours', header: 'OT (hrs)', meta: { align: 'right' } },
  { accessorKey: 'paidLeaveDays', header: 'Paid leave', meta: { align: 'right' } },
  { accessorKey: 'unpaidLeaveDays', header: 'Unpaid leave', meta: { align: 'right' } },
]

type Confirm = { status: PeriodStatus; title: string; description: string; cta: string } | null

export function PeriodDetailPage() {
  const { id = '' } = useParams()
  const role = useAuth((s) => s.session?.user.role)
  const period = usePeriod(id)
  const lines = usePayrollLines(id)
  const attendance = useAttendance(id)
  const compute = useComputePayroll()
  const setStatus = useSetPeriodStatus()
  const [tab, setTab] = useState<'register' | 'attendance'>('register')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [preview, setPreview] = useState<PayrollLine | null>(null)

  const p = period.data
  const hasLines = !!lines.data?.length
  const activeTab = hasLines ? tab : 'attendance'
  const error = compute.error ?? setStatus.error

  const totals = useMemo(() => {
    const l = lines.data ?? []
    const total = (k: keyof PayrollLine) => sum(l.map((x) => x[k] as string))
    return { basicPay: total('basicPay'), grossPay: total('grossPay'), totalDeductions: total('totalDeductions'), netPay: total('netPay') }
  }, [lines.data])

  if (period.isError) return <p className="text-muted">Payroll period not found.</p>
  if (!p) return <Skeleton className="h-96" />

  const actions = (
    <div className="flex flex-wrap gap-2">
      {(p.status === 'draft' || p.status === 'computed') && can(role, 'payroll.process') && (
        <Button variant={p.status === 'draft' ? 'primary' : 'outline'} disabled={compute.isPending} onClick={() => compute.mutate(p.id)}>
          {p.status === 'draft' ? <Calculator className="size-4" /> : <RotateCcw className="size-4" />}
          {compute.isPending ? 'Computing…' : p.status === 'draft' ? 'Compute payroll' : 'Recompute'}
        </Button>
      )}
      {p.status === 'computed' && can(role, 'payroll.process') && (
        <Button
          onClick={() =>
            setConfirm({
              status: 'review',
              title: 'Submit for review?',
              description: 'Finance and management will be able to review and approve this payroll.',
              cta: 'Submit for review',
            })
          }
        >
          <Send className="size-4" /> Submit for review
        </Button>
      )}
      {p.status === 'review' && (can(role, 'payroll.approve') || can(role, 'payroll.process')) && (
        <Button variant="outline" onClick={() => setStatus.mutate({ periodId: p.id, status: 'computed' })}>
          <Undo2 className="size-4" /> Return for changes
        </Button>
      )}
      {p.status === 'review' && can(role, 'payroll.approve') && (
        <Button
          onClick={() =>
            setConfirm({
              status: 'approved',
              title: 'Approve this payroll?',
              description: `Net pay of ${formatPeso(p.net)} for ${p.headcount} employees will be locked. It can no longer be recomputed.`,
              cta: 'Approve payroll',
            })
          }
        >
          <ShieldCheck className="size-4" /> Approve
        </Button>
      )}
      {p.status === 'approved' && can(role, 'payroll.release') && (
        <Button
          onClick={() =>
            setConfirm({
              status: 'released',
              title: 'Release payroll?',
              description: 'Payslips will be published to every employee’s AZONE app and the bank file becomes final.',
              cta: 'Release to AZONE',
            })
          }
        >
          <CheckCircle2 className="size-4" /> Release to AZONE
        </Button>
      )}
      {hasLines && (
        <Button
          variant="soft"
          onClick={() =>
            downloadCsv(
              `payroll-register-${p.end}.csv`,
              lines.data!.map((l) => ({
                'Employee No': l.employeeNo,
                Name: l.name,
                Department: l.department,
                Basic: l.basicPay,
                Overtime: l.overtimePay,
                Allowances: l.allowances,
                Absences: l.absencesDeduction,
                Late: l.lateDeduction,
                Gross: l.grossPay,
                SSS: l.sss,
                PhilHealth: l.philhealth,
                'Pag-IBIG': l.pagibig,
                Tax: l.withholdingTax,
                Other: l.otherDeductions,
                Net: l.netPay,
              })),
            )
          }
        >
          <Download className="size-4" /> Export register
        </Button>
      )}
    </div>
  )

  return (
    <>
      <Link to="/app/periods" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-primary">
        <ArrowLeft className="size-4" /> All payroll periods
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Payroll period</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {p.label} <PeriodStatusBadge status={p.status} />
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Pay date {formatDate(p.payDate, 'MMMM d, yyyy')}
            {p.approvedBy && ` · Approved by ${p.approvedBy}`}
          </p>
        </div>
        {actions}
      </div>

      {error && <p className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">{error.message}</p>}

      <Card className="p-5 sm:p-6">
        <PayrollStepper status={p.status} />
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {[
          ['Employees', String(p.headcount || attendance.data?.length || '—')],
          ['Gross pay', hasLines ? formatPeso(totals.grossPay) : '—'],
          ['Deductions', hasLines ? formatPeso(totals.totalDeductions) : '—'],
          ['Net pay', hasLines ? formatPeso(totals.netPay) : '—'],
        ].map(([label, value], i) => (
          <Card key={label} className={cn('p-5', i === 3 && 'border-primary-200 bg-primary-50')}>
            <p className="text-sm text-muted">{label}</p>
            <p className={cn('mt-1 text-xl font-bold sm:text-2xl', i === 3 ? 'text-primary' : 'text-navy')}>{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 mb-3 flex gap-1 rounded-xl bg-white p-1 shadow-card sm:inline-flex">
        {(['register', 'attendance'] as const).map((t) => (
          <button
            key={t}
            disabled={t === 'register' && !hasLines}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition disabled:opacity-40',
              activeTab === t ? 'bg-primary text-white' : 'text-ink hover:bg-primary-50 hover:text-primary',
            )}
          >
            {t === 'register' ? 'Payroll register' : 'Attendance input'}
          </button>
        ))}
      </div>

      {activeTab === 'register' ? (
        <DataTable
          data={lines.data}
          columns={registerColumns}
          loading={lines.isLoading}
          searchPlaceholder="Search employee…"
          onRowClick={setPreview}
        />
      ) : (
        <DataTable data={attendance.data} columns={attendanceColumns} loading={attendance.isLoading} searchPlaceholder="Search employee…" />
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title={confirm?.title ?? ''} description={confirm?.description}>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={setStatus.isPending}
            onClick={() => confirm && setStatus.mutate({ periodId: p.id, status: confirm.status }, { onSettled: () => setConfirm(null) })}
          >
            {setStatus.isPending ? 'Saving…' : confirm?.cta}
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Payslip preview">
        {preview && <PayslipView line={preview} period={p} />}
      </Dialog>
    </>
  )
}
