import { useMemo, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock,
  Download,
  FileUp,
  Lock,
  Pencil,
  RotateCcw,
  Sigma,
  Timer,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { PeriodSelect } from '@/components/shared/PeriodSelect'
import { useAttendance, usePeriod, useResetAttendance, useSaveAttendance } from '@/services/queries'
import type { AttendanceRow, PayrollPeriod } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { downloadCsv } from '@/lib/csv'
import { attendanceTemplate, readAttendanceCsv, type ImportResult } from '@/lib/attendanceImport'
import { cn } from '@/lib/cn'
import { DailyTimeRecords } from '@/features/attendance/DailyTimeRecords'
import { EmployeeFilter } from '@/components/shared/EmployeeFilter'
import { PresentDays, attendanceRate } from '@/components/shared/PresentDays'

const sourceBadge = { manual: 'Edited', upload: 'Uploaded' } as const

function buildColumns(onEdit?: (r: AttendanceRow) => void): ColumnDef<AttendanceRow>[] {
  const cols: ColumnDef<AttendanceRow>[] = [
    {
      accessorKey: 'name',
      header: 'Employee',
      cell: ({ row }) => (
        <span>
          <span className="flex items-center gap-2 font-semibold text-navy">
            {row.original.name}
            {(row.original.source === 'manual' || row.original.source === 'upload') && (
              <Badge size="sm" tone="violet">
                {sourceBadge[row.original.source]}
              </Badge>
            )}
          </span>
          <span className="block text-xs text-muted">{row.original.employeeNo}</span>
        </span>
      ),
    },
    { accessorKey: 'department', header: 'Department' },
    {
      accessorKey: 'daysPresent',
      header: 'Present',
      meta: { align: 'right' },
      cell: ({ row }) => <PresentDays row={row.original} />,
    },
    {
      accessorKey: 'absentDays',
      header: 'Absent',
      meta: { align: 'right' },
      cell: ({ getValue }) =>
        getValue<number>() ? (
          <Badge size="sm" tone="danger">
            {getValue<number>()}
          </Badge>
        ) : (
          0
        ),
    },
    {
      accessorKey: 'lateMinutes',
      header: 'Late (min)',
      meta: { align: 'right' },
      cell: ({ getValue }) =>
        getValue<number>() ? (
          <Badge size="sm" tone="warning">
            {getValue<number>()}
          </Badge>
        ) : (
          0
        ),
    },
    { accessorKey: 'overtimeHours', header: 'OT (hrs)', meta: { align: 'right' } },
    { accessorKey: 'paidLeaveDays', header: 'Paid leave', meta: { align: 'right' } },
    { accessorKey: 'unpaidLeaveDays', header: 'Unpaid leave', meta: { align: 'right' } },
  ]
  if (onEdit)
    cols.push({
      id: 'edit',
      header: '',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Edit ${row.original.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(row.original)
          }}
          className="rounded-lg p-1.5 text-muted transition hover:bg-primary-50 hover:text-primary"
        >
          <Pencil className="size-4" />
        </button>
      ),
    })
  return cols
}

const views = [
  { id: 'daily', label: 'Daily time records', icon: CalendarDays },
  { id: 'summary', label: 'Cut-off summary', icon: Sigma },
] as const

export function AttendancePage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'summary' ? 'summary' : 'daily'
  // Shared by both tabs, so the chosen employees stay picked when switching days or tabs
  const [picked, setPicked] = useState<string[]>([])

  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Attendance & DTR"
        description="Enter each day’s time in and out, or import a file. Payroll uses the cut-off totals built from these records."
      />
      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1 shadow-card sm:inline-flex">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'daily' ? {} : { view: id }, { replace: true })}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
              view === id ? 'bg-primary text-white' : 'text-ink hover:bg-primary-50 hover:text-primary',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {view === 'daily' ? <DailyTimeRecords picked={picked} onPick={setPicked} /> : <CutoffSummary picked={picked} onPick={setPicked} />}
    </>
  )
}

/** Per-employee totals for a whole cut-off (what payroll computes from), with HR's direct edits and uploads. */
function CutoffSummary({ picked, onPick }: { picked: string[]; onPick: (ids: string[]) => void }) {
  const [periodId, setPeriodId] = useState('')
  const { data, isLoading } = useAttendance(periodId)
  const shown = useMemo(() => (data && picked.length ? data.filter((r) => picked.includes(r.employeeId)) : data), [data, picked])
  const { data: period } = usePeriod(periodId)
  const role = useAuth((s) => s.session?.user.role)
  const [editing, setEditing] = useState<AttendanceRow | null>(null)
  const [uploading, setUploading] = useState(false)

  const canManage = can(role, 'attendance.manage')
  const open = period?.status === 'draft' || period?.status === 'computed'
  const editable = canManage && open
  const columns = useMemo(() => buildColumns(editable ? setEditing : undefined), [editable])
  const totals = (k: keyof AttendanceRow) => (shown ?? []).reduce((s, r) => s + (r[k] as number), 0)

  const stats = [
    {
      icon: CalendarCheck,
      tone: 'success' as const,
      label: 'Attendance rate',
      // Only days that have already happened count — upcoming ones are assumed present
      value: shown?.length && attendanceRate(shown) !== null ? `${attendanceRate(shown)}%` : '—',
    },
    { icon: CalendarX, tone: 'danger' as const, label: 'Absences', value: totals('absentDays') },
    { icon: Clock, tone: 'warning' as const, label: 'Late minutes', value: totals('lateMinutes') },
    { icon: Timer, tone: 'primary' as const, label: 'Overtime hours', value: totals('overtimeHours') },
  ]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <PeriodSelect value={periodId} onChange={setPeriodId} />
        <EmployeeFilter
          options={(data ?? []).map((r) => ({ id: r.employeeId, name: r.name, department: r.department }))}
          value={picked}
          onChange={onPick}
        />
        {editable && (
          <Button variant="outline" onClick={() => setUploading(true)} disabled={!data}>
            <Upload className="size-4" /> Upload cut-off totals
          </Button>
        )}
        <p className="text-xs text-muted sm:ml-2">Built from the daily time records. Edit a row only to override a whole cut-off.</p>
      </div>
      {canManage && period && !open && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary">
          <Lock className="size-4 shrink-0" /> This cut-off’s payroll is already {period.status}, so its attendance is locked.
        </p>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-xs text-muted sm:text-sm">{s.label}</p>
              <p className="text-xl font-bold text-navy">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <DataTable
        data={shown}
        columns={columns}
        loading={isLoading || !periodId}
        searchPlaceholder="Search employee…"
        pageSize={12}
        onRowClick={editable ? setEditing : undefined}
        toolbar={
          data?.length ? (
            <Button variant="soft" size="sm" onClick={() => downloadCsv(`attendance-${period?.end ?? 'cutoff'}.csv`, attendanceTemplate(data))}>
              <Download className="size-4" /> {editable ? 'Template' : 'Export'}
            </Button>
          ) : null
        }
      />
      {editing && period && <EditDialog period={period} row={editing} onClose={() => setEditing(null)} />}
      {uploading && period && data && <UploadDialog period={period} rows={data} onClose={() => setUploading(false)} />}
    </>
  )
}

function RecomputeNote({ period }: { period: PayrollPeriod }) {
  if (period.status !== 'computed') return null
  return (
    <p className="mb-4 flex gap-2 rounded-xl bg-warning-50 px-3.5 py-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      Payroll for this cut-off is already computed. Saving sends it back to Draft — compute it again afterwards.
    </p>
  )
}

/** Edit one employee's cut-off. Present is derived, so the days always add up to the working days. */
function EditDialog({ period, row, onClose }: { period: PayrollPeriod; row: AttendanceRow; onClose: () => void }) {
  const save = useSaveAttendance()
  const reset = useResetAttendance()
  const [v, setV] = useState({
    absentDays: String(row.absentDays),
    lateMinutes: String(row.lateMinutes),
    paidLeaveDays: String(row.paidLeaveDays),
    unpaidLeaveDays: String(row.unpaidLeaveDays),
  })
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const absentDays = n(v.absentDays)
  const paidLeaveDays = n(v.paidLeaveDays)
  const unpaidLeaveDays = n(v.unpaidLeaveDays)
  const lateMinutes = n(v.lateMinutes)
  const daysPresent = row.workingDays - absentDays - paidLeaveDays - unpaidLeaveDays

  const halfOk = (x: number) => Number.isFinite(x) && x >= 0 && Number.isInteger(x * 2)
  const error = ![absentDays, paidLeaveDays, unpaidLeaveDays].every(halfOk)
    ? 'Days must be whole or half numbers (e.g. 1 or 0.5).'
    : !(Number.isInteger(lateMinutes) && lateMinutes >= 0)
      ? 'Late minutes must be a whole number.'
      : daysPresent < 0
        ? `Absences and leave can’t exceed the ${row.workingDays} working days.`
        : null
  const busy = save.isPending || reset.isPending
  const failure = save.error ?? reset.error

  const field = (key: keyof typeof v, label: string, step: string) => (
    <Field label={label}>
      <Input type="number" min={0} step={step} inputMode="decimal" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
    </Field>
  )

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit attendance · ${row.name}`}
      description={`${period.label} · ${row.workingDays} working days`}
    >
      <RecomputeNote period={period} />
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (error) return
          await save.mutateAsync({
            periodId: period.id,
            source: 'manual',
            rows: [{ employeeId: row.employeeId, daysPresent, absentDays, lateMinutes, paidLeaveDays, unpaidLeaveDays }],
          })
          onClose()
        }}
        className="grid grid-cols-2 gap-3"
      >
        {field('absentDays', 'Absent (days)', '0.5')}
        {field('lateMinutes', 'Late (minutes)', '1')}
        {field('paidLeaveDays', 'Paid leave (days)', '0.5')}
        {field('unpaidLeaveDays', 'Unpaid leave (days)', '0.5')}
        <div className="col-span-2 flex items-center justify-between rounded-xl bg-bg px-4 py-3 text-sm">
          <span className="text-muted">Days present</span>
          <span className="font-bold text-navy">
            {Number.isFinite(daysPresent) ? daysPresent : '—'} <span className="font-normal text-muted">/ {row.workingDays}</span>
          </span>
        </div>
        <p className="col-span-2 text-xs text-muted">Overtime comes from approved filings on the Overtime page.</p>
        <div className="col-span-2 mt-1">
          {(error || failure) && <p className="mb-2 text-sm text-danger">{error ?? failure?.message}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {(row.source === 'manual' || row.source === 'upload') && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  await reset.mutateAsync({ periodId: period.id, employeeId: row.employeeId })
                  onClose()
                }}
              >
                <RotateCcw className="size-4" /> Use DTR records
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy || !!error}>
              {save.isPending ? 'Saving…' : 'Save attendance'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

/** Upload a CSV for the whole cut-off; preview the changes and problems before anything is saved. */
function UploadDialog({ period, rows, onClose }: { period: PayrollPeriod; rows: AttendanceRow[]; onClose: () => void }) {
  const save = useSaveAttendance()
  const [file, setFile] = useState<{ name: string; result: ImportResult } | null>(null)

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.csv$/i.test(f.name)) {
      setFile({ name: f.name, result: { changes: [], unchanged: 0, errors: ['Upload a .csv file. In Excel: File → Save As → CSV.'] } })
      return
    }
    setFile({ name: f.name, result: readAttendanceCsv(await f.text(), rows) })
  }

  const r = file?.result
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Upload attendance"
      description={`${period.label} · one row per employee, matched by name`}
    >
      <RecomputeNote period={period} />
      <ol className="mb-4 space-y-1.5 text-sm text-ink">
        <li>
          1.{' '}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => downloadCsv(`attendance-${period.end}.csv`, attendanceTemplate(rows))}
          >
            Download the template
          </button>{' '}
          — it’s pre-filled with the current numbers.
        </li>
        <li>2. Fill in Absent, Late (min), Paid and Unpaid leave. Leave Present blank to have it calculated.</li>
        <li>3. Save as CSV and upload it here.</li>
      </ol>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/50 px-4 py-6 text-center transition hover:border-primary hover:bg-primary-50">
        <FileUp className="size-7 text-primary" />
        <span className="text-sm font-semibold text-navy">{file ? file.name : 'Choose a CSV file'}</span>
        <span className="text-xs text-muted">{file ? 'Choose another to replace it' : 'Exported from Excel, Google Sheets or your biometrics'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={pick} />
      </label>

      {r && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{r.changes.length} to update</Badge>
            <Badge tone="neutral">{r.unchanged} unchanged</Badge>
            {r.errors.length > 0 && <Badge tone="danger">{r.errors.length} with problems</Badge>}
          </div>
          {r.errors.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-danger-50 px-3.5 py-2.5 text-xs text-danger">
              {r.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {r.changes.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Employee</th>
                    <th className="px-2 py-2 text-right font-semibold">Absent</th>
                    <th className="px-2 py-2 text-right font-semibold">Late</th>
                    <th className="px-2 py-2 text-right font-semibold">Leave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.changes.map(({ input: i, before: b }) => (
                    <tr key={i.employeeId}>
                      <td className="px-3 py-1.5 font-medium text-navy">{b.name}</td>
                      <Diff from={b.absentDays} to={i.absentDays} />
                      <Diff from={b.lateMinutes} to={i.lateMinutes} />
                      <Diff from={b.paidLeaveDays + b.unpaidLeaveDays} to={i.paidLeaveDays + i.unpaidLeaveDays} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {r.errors.length > 0 && r.changes.length > 0 && (
            <p className="text-xs text-muted">Rows with problems are skipped; those employees keep their current numbers.</p>
          )}
        </div>
      )}

      {save.isError && <p className="mt-3 text-sm text-danger">{save.error.message}</p>}
      <Button
        className="mt-5 w-full"
        disabled={!r?.changes.length || save.isPending}
        onClick={async () => {
          await save.mutateAsync({ periodId: period.id, source: 'upload', rows: r!.changes.map((c) => c.input) })
          onClose()
        }}
      >
        {save.isPending
          ? 'Saving…'
          : r?.changes.length
            ? `Update ${r.changes.length} employee${r.changes.length > 1 ? 's' : ''}`
            : 'Nothing to update yet'}
      </Button>
    </Dialog>
  )
}

function Diff({ from, to }: { from: number; to: number }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums">
      {from === to ? (
        <span className="text-muted">{to}</span>
      ) : (
        <>
          <span className="text-muted line-through">{from}</span> <b className="text-navy">{to}</b>
        </>
      )}
    </td>
  )
}
