import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Baby,
  BookOpen,
  CalendarClock,
  Check,
  CircleDollarSign,
  FileBadge,
  FileQuestion,
  HeartHandshake,
  Inbox,
  PlaneTakeoff,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { ApprovalBadge } from '@/components/shared/StatusBadges'
import { EmployeeFilter } from '@/components/shared/EmployeeFilter'
import { useDecideLeave, useDecideOvertime, useDecideRequest, useEmployees, useLeaves, useOvertime, useRequests } from '@/services/queries'
import type { ApprovalStatus, AzoneRequest, LeaveRecord, OvertimeKind, OvertimeRequest } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { OT_MULTIPLIERS, dailyRate, sum } from '@/lib/payroll'
import { formatDate, formatPeso } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'

export const otKindLabel: Record<OvertimeKind, string> = {
  regular: 'Regular day',
  restDay: 'Rest day',
  specialHoliday: 'Special holiday',
  regularHoliday: 'Regular holiday',
}
const otRate = (k: OvertimeKind) => `${Math.round(Number(OT_MULTIPLIERS[k]) * 100)}%`

const leaveLabel: Record<LeaveRecord['type'], string> = {
  vacation: 'Vacation leave',
  sick: 'Sick leave',
  emergency: 'Emergency leave',
  birthday: 'Birthday leave',
  unpaid: 'Leave without pay',
}

/** Icons for AZONE request kinds; anything unknown (or retired, like reimbursement) gets the generic one. */
const requestIcon: Record<string, LucideIcon> = {
  coe: FileBadge,
  schedule_change: CalendarClock,
  overtime: Timer,
  maternity_leave: Baby,
  paternity_leave: Baby,
  solo_parent_leave: HeartHandshake,
  study_leave: BookOpen,
}

type Source = 'leave' | 'overtime' | 'request'
type Row = {
  key: string
  source: Source
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: string
  icon: LucideIcon
  summary: string
  /** Peso impact on pay: negative = deduction, positive = added overtime pay; null = none/unknown */
  impact: { text: string; tone: 'danger' | 'success' | 'muted' } | null
  status: ApprovalStatus
  sortDate: string
  leave?: LeaveRecord
  overtime?: OvertimeRequest
  request?: AzoneRequest
}

const sources: { id: Source | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'leave', label: 'Leaves' },
  { id: 'overtime', label: 'Overtime' },
  { id: 'request', label: 'Other requests' },
]
const statuses: { id: ApprovalStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

const range = (start: string, end: string) => (start === end ? formatDate(start) : `${formatDate(start, 'MMM d')} – ${formatDate(end)}`)

/** One inbox for everything employees send from AZONE: leaves (with their payroll impact), overtime and other requests. */
export function RequestsPage() {
  const leaves = useLeaves()
  const ot = useOvertime()
  const requests = useRequests()
  const employees = useEmployees()
  const decideLeave = useDecideLeave()
  const decideOt = useDecideOvertime()
  const decideRequest = useDecideRequest()
  const role = useAuth((s) => s.session?.user.role)
  const canDecide = can(role, 'overtime.decide')

  const [source, setSource] = useState<Source | 'all'>('all')
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('pending')
  const [picked, setPicked] = useState<string[]>([])
  const [open, setOpen] = useState<Row | null>(null)
  const [approvingOt, setApprovingOt] = useState<AzoneRequest | null>(null)

  const all = useMemo<Row[]>(() => {
    const basic = new Map((employees.data ?? []).map((e) => [e.id, e.monthlyBasic]))
    const out: Row[] = []
    for (const l of leaves.data ?? []) {
      const b = basic.get(l.employeeId)
      out.push({
        key: `leave-${l.id}`,
        source: 'leave',
        id: l.id,
        employeeId: l.employeeId,
        employeeName: l.employeeName,
        department: l.department,
        type: leaveLabel[l.type] ?? l.type,
        icon: PlaneTakeoff,
        summary: `${range(l.start, l.end)} · ${l.days} day${l.days === 1 ? '' : 's'}`,
        impact: l.paid
          ? { text: 'With pay', tone: 'muted' }
          : { text: b ? `−${formatPeso(dailyRate(b).times(l.days).toFixed(2))}` : 'Without pay', tone: 'danger' },
        status: l.status,
        sortDate: l.start,
        leave: l,
      })
    }
    // Overtime that came from an AZONE request is shown through that request instead
    for (const o of (ot.data ?? []).filter((x) => !x.requestId)) {
      out.push({
        key: `ot-${o.id}`,
        source: 'overtime',
        id: o.id,
        employeeId: o.employeeId,
        employeeName: o.employeeName,
        department: o.department,
        type: 'Overtime',
        icon: Timer,
        summary: `${formatDate(o.date)} · ${o.hours} h · ${otKindLabel[o.kind]} (${otRate(o.kind)})`,
        impact: { text: `+${o.hours} h OT`, tone: 'success' },
        status: o.status,
        sortDate: o.date,
        overtime: o,
      })
    }
    for (const r of requests.data ?? []) {
      out.push({
        key: `req-${r.id}`,
        source: r.kind === 'overtime' ? 'overtime' : 'request',
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        department: r.department,
        type: r.title,
        icon: requestIcon[r.kind] ?? FileQuestion,
        summary: r.overtime ? `${formatDate(r.overtime.date)} · ${r.overtime.hours} h · ${otKindLabel[r.overtime.kind]}` : r.details,
        impact: r.overtime ? { text: `+${r.overtime.hours} h OT`, tone: 'success' } : null,
        status: r.status,
        sortDate: r.filedAt.slice(0, 10),
        request: r,
      })
    }
    return out.sort((a, b) => b.sortDate.localeCompare(a.sortDate))
  }, [leaves.data, ot.data, requests.data, employees.data])

  const shown = all.filter(
    (r) =>
      (source === 'all' || r.source === source) && (status === 'all' || r.status === status) && (!picked.length || picked.includes(r.employeeId)),
  )
  const pending = all.filter((r) => r.status === 'pending')
  const approvedUnpaid = all.filter((r) => r.leave && r.status === 'approved' && !r.leave.paid)
  const unpaidTotal = sum(
    approvedUnpaid.map((r) => {
      const b = employees.data?.find((e) => e.id === r.employeeId)?.monthlyBasic
      return b ? dailyRate(b).times(r.leave!.days).toFixed(2) : '0'
    }),
  )
  const approvedOtHours = all
    .filter((r) => r.status === 'approved' && r.impact?.tone === 'success')
    .reduce((s, r) => s + (r.overtime?.hours ?? r.request?.overtime?.hours ?? 0), 0)

  const stats = [
    { icon: Inbox, tone: 'warning' as const, label: 'Waiting for you', value: String(pending.length) },
    { icon: CircleDollarSign, tone: 'danger' as const, label: 'Approved leave without pay', value: formatPeso(unpaidTotal) },
    { icon: Timer, tone: 'success' as const, label: 'Approved overtime', value: `${approvedOtHours} h` },
  ]

  const busy = decideLeave.isPending || decideOt.isPending || decideRequest.isPending
  const error = decideLeave.error ?? decideOt.error ?? decideRequest.error

  function decide(row: Row, to: 'approved' | 'rejected') {
    if (row.request?.kind === 'overtime' && to === 'approved') return setApprovingOt(row.request)
    const done = () => setOpen(null)
    if (row.leave) decideLeave.mutate({ id: row.id, status: to }, { onSuccess: done })
    else if (row.overtime) decideOt.mutate({ id: row.id, status: to }, { onSuccess: done })
    else decideRequest.mutate({ id: row.id, status: to }, { onSuccess: done })
  }

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
    {
      accessorKey: 'type',
      header: 'Request',
      cell: ({ row }) => {
        const Icon = row.original.icon
        return (
          <span className="flex items-center gap-2 font-medium text-navy">
            <Icon className="size-4 shrink-0 text-primary" /> {row.original.type}
          </span>
        )
      },
    },
    {
      accessorKey: 'summary',
      header: 'Details',
      cell: ({ getValue }) => <span className="block max-w-72 truncate text-ink">{getValue<string>()}</span>,
    },
    {
      id: 'impact',
      header: 'Pay',
      cell: ({ row }) => {
        const i = row.original.impact
        if (!i) return <span className="text-muted">—</span>
        return (
          <span
            className={cn(
              'font-semibold whitespace-nowrap',
              i.tone === 'danger' ? 'text-danger' : i.tone === 'success' ? 'text-success' : 'text-muted',
            )}
          >
            {i.text}
          </span>
        )
      },
    },
    {
      accessorKey: 'sortDate',
      header: 'Date',
      cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue<string>(), 'MMM d, yyyy')}</span>,
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <ApprovalBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.status === 'pending' && canDecide ? (
          <span className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => decide(row.original, 'approved')}
              disabled={busy}
              className="rounded-lg bg-success-50 p-1.5 text-success transition hover:bg-success hover:text-white disabled:opacity-50"
              aria-label={`Approve ${row.original.type} for ${row.original.employeeName}`}
              title="Approve"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={() => decide(row.original, 'rejected')}
              disabled={busy}
              className="rounded-lg bg-danger-50 p-1.5 text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
              aria-label={`Reject ${row.original.type} for ${row.original.employeeName}`}
              title="Reject"
            >
              <X className="size-4" />
            </button>
          </span>
        ) : null,
    },
  ]

  const loading = leaves.isLoading || ot.isLoading || requests.isLoading || employees.isLoading

  return (
    <>
      <PageHeader
        eyebrow="People & Time"
        title="Requests"
        description="Everything employees file in AZONE — leaves, overtime and other requests. Approving or rejecting notifies them in AZONE; approved leave without pay is deducted, approved overtime is paid."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 sm:gap-5">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-bold text-navy">{loading ? '—' : s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-surface p-1 shadow-card">
          {sources.map((s) => {
            const n = pending.filter((r) => s.id === 'all' || r.source === s.id).length
            return (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition',
                  source === s.id ? 'bg-primary text-white' : 'text-ink hover:bg-primary-50 hover:text-primary',
                )}
              >
                {s.label}
                {n > 0 && (
                  <span className={cn('rounded-full px-1.5 text-[11px] font-bold', source === s.id ? 'bg-white/25' : 'bg-warning-50 text-warning')}>
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus | 'all')} className="w-auto py-2" aria-label="Status">
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <EmployeeFilter
          options={(employees.data ?? [])
            .filter((e) => e.status !== 'resigned')
            .map((e) => ({ id: e.id, name: e.fullName, department: e.department }))}
          value={picked}
          onChange={setPicked}
        />
      </div>

      {error && <p className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">{error.message}</p>}

      <DataTable
        data={shown}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search name, request or details…"
        onRowClick={setOpen}
        empty={
          <div className="py-12 text-center text-sm text-muted">
            {status === 'pending' ? 'Nothing waiting — you’re all caught up.' : 'No requests match these filters.'}
          </div>
        }
      />

      {open && <RequestDialog row={open} canDecide={canDecide} busy={busy} onDecide={(to) => decide(open, to)} onClose={() => setOpen(null)} />}
      {approvingOt && (
        <ApproveOvertimeDialog
          request={approvingOt}
          busy={decideRequest.isPending}
          error={decideRequest.error?.message}
          onApprove={(o) =>
            decideRequest.mutate(
              { id: approvingOt.id, status: 'approved', overtime: o },
              {
                onSuccess: () => {
                  setApprovingOt(null)
                  setOpen(null)
                },
              },
            )
          }
          onClose={() => setApprovingOt(null)}
        />
      )}
    </>
  )
}

function RequestDialog({
  row,
  canDecide,
  busy,
  onDecide,
  onClose,
}: {
  row: Row
  canDecide: boolean
  busy: boolean
  onDecide: (to: 'approved' | 'rejected') => void
  onClose: () => void
}) {
  const r = row.request
  const facts: [string, string][] = row.leave
    ? [
        ['Dates', range(row.leave.start, row.leave.end)],
        ['Days', String(row.leave.days)],
        ['Pay', row.leave.paid ? 'With pay' : `Without pay${row.impact ? ` (${row.impact.text})` : ''}`],
      ]
    : row.overtime
      ? [
          ['Date', formatDate(row.overtime.date)],
          ['Hours', `${row.overtime.hours} h`],
          ['Type', `${otKindLabel[row.overtime.kind]} · paid at ${otRate(row.overtime.kind)}`],
          ['Reason', row.overtime.reason || '—'],
        ]
      : [
          ['Filed', formatDate(r!.filedAt, 'MMM d, yyyy · h:mm a')],
          ...(r!.overtime
            ? ([['Paid as', `${r!.overtime.hours} h on ${formatDate(r!.overtime.date)} · ${otKindLabel[r!.overtime.kind]}`]] as [string, string][])
            : []),
          ...(r!.decidedBy ? ([['Decided by', r!.decidedBy]] as [string, string][]) : []),
        ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={row.type} description={`${row.employeeName} · ${row.department}`}>
      <div className="mb-4 flex items-center gap-2">
        <ApprovalBadge status={row.status} />
        <Badge size="sm" tone="neutral">
          From AZONE
        </Badge>
      </div>
      {r && <p className="mb-4 rounded-xl bg-bg p-4 text-sm whitespace-pre-wrap text-ink">{r.details}</p>}
      <dl className="divide-y divide-line text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium text-navy">{v}</dd>
          </div>
        ))}
      </dl>
      {r?.kind === 'overtime' && row.status === 'pending' && (
        <p className="mt-3 text-xs text-muted">Approving asks for the date, hours and type so the overtime is paid in that cut-off.</p>
      )}
      {row.status === 'pending' && canDecide && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onDecide('rejected')}>
            <X className="size-4" /> Reject
          </Button>
          <Button disabled={busy} onClick={() => onDecide('approved')}>
            <Check className="size-4" /> Approve
          </Button>
        </div>
      )}
    </Dialog>
  )
}

/** AZONE overtime requests are free text, so HR confirms what to pay before approving. */
function ApproveOvertimeDialog({
  request,
  busy,
  error,
  onApprove,
  onClose,
}: {
  request: AzoneRequest
  busy: boolean
  error?: string
  onApprove: (o: { date: string; hours: number; kind: OvertimeKind }) => void
  onClose: () => void
}) {
  const today = manilaToday()
  const [date, setDate] = useState(request.filedAt.slice(0, 10) > today ? today : request.filedAt.slice(0, 10))
  const [hours, setHours] = useState('')
  const [kind, setKind] = useState<OvertimeKind>('regular')
  const h = Number(hours)
  const invalid = !(h >= 0.5 && h <= 16 && Number.isInteger(h * 2))
    ? 'Enter 0.5 to 16 hours, in half hours'
    : !date || date > today
      ? 'Pick a date up to today'
      : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Approve overtime" description={`${request.employeeName} · confirm what to pay`}>
      <p className="mb-4 rounded-xl bg-bg p-4 text-sm whitespace-pre-wrap text-ink">“{request.details}”</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!invalid) onApprove({ date, hours: h, kind })
        }}
        className="grid grid-cols-2 gap-3"
      >
        <Field label="Date worked">
          <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Overtime hours">
          <Input
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            inputMode="decimal"
            placeholder="e.g. 3"
            autoFocus
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as OvertimeKind)}>
              {(Object.keys(OT_MULTIPLIERS) as OvertimeKind[]).map((k) => (
                <option key={k} value={k}>
                  {otKindLabel[k]} — paid at {otRate(k)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="col-span-2 text-xs text-muted">
          Paid in the cut-off that includes this date. If that payroll is already computed, it goes back to Draft to be recomputed.
        </p>
        {(error || (hours && invalid)) && <p className="col-span-2 text-sm text-danger">{error ?? invalid}</p>}
        <Button type="submit" className="col-span-2" disabled={busy || !!invalid}>
          <Check className="size-4" /> {busy ? 'Approving…' : 'Approve & pay overtime'}
        </Button>
      </form>
    </Dialog>
  )
}
