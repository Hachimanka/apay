import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eraser,
  FileUp,
  Info,
  Lock,
  Plane,
  Search,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmployeeFilter } from '@/components/shared/EmployeeFilter'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { IconTile } from '@/components/ui/IconTile'
import { Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useDailyAttendance, useSaveTimeRecords } from '@/services/queries'
import type { DailyRow, DailyStatus, Punches } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  manilaToday,
  punchError,
  punchKeys,
  punchLabels,
  readTimeRecords,
  samePunches,
  shiftDay,
  timeRecordTemplate,
  emptyPunches,
} from '@/lib/timeRecords'

const statusBadge: Record<DailyStatus, { label: string; tone: BadgeTone }> = {
  present: { label: 'Present', tone: 'success' },
  late: { label: 'Late', tone: 'warning' },
  absent: { label: 'Absent', tone: 'danger' },
  leave: { label: 'On leave', tone: 'violet' },
  rest: { label: 'Rest day', tone: 'neutral' },
  holiday: { label: 'Holiday', tone: 'primary' },
  pending: { label: 'No time-in yet', tone: 'neutral' },
}

const sourceLabel: Record<NonNullable<DailyRow['source']>, string> = {
  azone: 'AZONE app',
  biometric: 'Biometric',
  manual: 'Entered by HR',
  upload: 'Uploaded',
}

const lockedStatuses = new Set(['review', 'approved', 'released'])

type ImportOutcome = { file: string; saved: number; skipped: number; blank: number; dates: string[]; errors: string[] } | null

/** HR's daily DTR: every employee's time in/out for one day — typed in, filled from the regular shift, or imported from a file. */
export function DailyTimeRecords({ picked, onPick }: { picked: string[]; onPick: (ids: string[]) => void }) {
  const [params, setParams] = useSearchParams()
  const today = manilaToday()
  const date = params.get('date') && params.get('date')! <= today ? params.get('date')! : today
  const setDate = (d: string) =>
    setParams(
      (p) => {
        p.set('date', d)
        return p
      },
      { replace: true },
    )

  const { data, isLoading, error: loadError } = useDailyAttendance(date)
  const save = useSaveTimeRecords()
  const role = useAuth((s) => s.session?.user.role)
  const [drafts, setDrafts] = useState<Record<string, Punches>>({})
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<ImportOutcome>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // A different day (or fresh data after saving) starts from what's on file
  useEffect(() => setDrafts({}), [date, data])

  const locked = !!data?.period && lockedStatuses.has(data.period.status)
  // Without the day's employee list there is nothing to match an upload against, so editing waits for it
  const editable = can(role, 'attendance.manage') && !!data && !locked && date <= today

  const allRows = data?.rows ?? []
  // The employee filter narrows what's shown (and what "Fill blanks" touches); uploads and the template still cover everyone
  const rows = useMemo(() => (picked.length ? allRows.filter((r) => picked.includes(r.employeeId)) : allRows), [allRows, picked])
  const current = (r: DailyRow): Punches => drafts[r.employeeId] ?? r
  const changed = allRows.filter((r) => drafts[r.employeeId] && !samePunches(drafts[r.employeeId], r))
  const invalid = changed.filter((r) => punchError(drafts[r.employeeId]))
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => `${r.name} ${r.employeeNo} ${r.department}`.toLowerCase().includes(q)) : rows
  }, [rows, query])

  const count = (...s: DailyStatus[]) => rows.filter((r) => s.includes(r.status)).length
  const stats = [
    { icon: CalendarCheck, tone: 'success' as const, label: 'Present', value: count('present', 'late') },
    { icon: Clock, tone: 'warning' as const, label: 'Late', value: count('late') },
    { icon: CalendarX, tone: 'danger' as const, label: date < today ? 'Absent' : 'No time-in yet', value: count('absent', 'pending') },
    { icon: Plane, tone: 'violet' as const, label: 'On leave', value: count('leave') },
  ]

  const setPunch = (r: DailyRow, key: (typeof punchKeys)[number], value: string) =>
    setDrafts((d) => ({ ...d, [r.employeeId]: { ...current(r), [key]: value || null } }))

  const fillBlanks = () => {
    if (!data) return
    const next = { ...drafts }
    for (const r of rows)
      if ((r.status === 'absent' || r.status === 'pending') && punchKeys.every((k) => !current(r)[k])) next[r.employeeId] = { ...data.shift }
    setDrafts(next)
  }
  const blanksToFill = rows.filter((r) => (r.status === 'absent' || r.status === 'pending') && punchKeys.every((k) => !current(r)[k])).length

  const saveChanges = () =>
    save.mutate({
      source: 'manual',
      rows: changed.map((r) => ({ employeeId: r.employeeId, date, ...drafts[r.employeeId] })),
    })

  async function importFile(file: File) {
    setOutcome(null)
    save.reset()
    const name = file.name
    if (!/\.(csv|xlsx)$/i.test(name)) {
      setOutcome({
        file: name,
        saved: 0,
        skipped: 0,
        blank: 0,
        dates: [],
        errors: ['Use a .csv or .xlsx file. Older .xls files: open in Excel and Save As .xlsx.'],
      })
      return
    }
    setImporting(true)
    try {
      const sheet = /\.xlsx$/i.test(name) ? await (await import('read-excel-file/browser')).readSheet(file) : parseCsv(await file.text())
      const read = readTimeRecords(sheet as Parameters<typeof readTimeRecords>[0], allRows, date, today)
      let saved = 0
      if (read.rows.length) saved = (await save.mutateAsync({ source: 'upload', rows: read.rows })).saved
      setOutcome({ file: name, saved, skipped: read.errors.length, blank: read.blank, dates: read.dates, errors: read.errors })
    } catch (e) {
      setOutcome({ file: name, saved: 0, skipped: 0, blank: 0, dates: [], errors: [e instanceof Error ? e.message : 'Couldn’t read that file'] })
    } finally {
      setImporting(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && editable) void importFile(file)
  }

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!editable || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {/* Day picker */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous day" disabled={changed.length > 0} onClick={() => setDate(shiftDay(date, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          max={today}
          disabled={changed.length > 0}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-auto py-2"
          aria-label="Day"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={changed.length > 0 || date >= today}
          onClick={() => setDate(shiftDay(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {date !== today && (
          <Button variant="soft" size="sm" disabled={changed.length > 0} onClick={() => setDate(today)}>
            Today
          </Button>
        )}
        <p className="ml-1 text-sm text-muted">
          <b className="text-navy">{formatDate(date, 'EEEE, MMMM d, yyyy')}</b>
          {data?.holiday && ' · Holiday'}
          {data?.weekend && !data.holiday && ' · Weekend'}
          {data?.period && ` · ${data.period.label} payroll is ${data.period.status}`}
        </p>
        {changed.length > 0 && <span className="text-xs text-muted">Save or discard changes to switch days</span>}
      </div>

      {loadError && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">
          <AlertTriangle className="size-4 shrink-0" /> Couldn’t load this day’s time records: {loadError.message}. Uploading is paused until it loads
          — if the API was just updated, restart it.
        </p>
      )}

      {locked && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary">
          <Lock className="size-4 shrink-0" /> The {data!.period!.label} payroll is already {data!.period!.status}, so this day’s time records are
          locked.
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-xs text-muted sm:text-sm">{s.label}</p>
              <p className="text-xl font-bold text-navy">{isLoading ? '—' : s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {editable && (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mb-5 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-5 py-4 text-left transition hover:border-primary hover:bg-primary-50"
        >
          <IconTile icon={importing ? Clock : FileUp} className={cn(importing && 'animate-pulse')} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-navy">{importing ? 'Importing…' : 'Drop a CSV or Excel file here, or click to upload'}</span>
            <span className="block text-xs text-muted">
              Saved right away. One row per employee per day, matched by the employee’s name. Add a Date column to import several days at once.
            </span>
          </span>
          <Upload className="hidden size-5 text-primary sm:block" />
        </button>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importFile(f)
        }}
      />

      <AnimatePresence>{outcome && <ImportResult outcome={outcome} viewing={date} onClose={() => setOutcome(null)} />}</AnimatePresence>

      {/* No overflow clipping here: the employee filter dropdown has to spill out of the card */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <EmployeeFilter
            options={allRows.map((r) => ({ id: r.employeeId, name: r.name, department: r.department }))}
            value={picked}
            onChange={onPick}
          />
          <div className="relative min-w-48 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee…"
              className="w-full rounded-xl border border-line bg-bg py-2 pr-3 pl-9 text-sm text-navy placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-100 focus:outline-none"
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {editable && blanksToFill > 0 && data && (
              <Button variant="soft" size="sm" onClick={fillBlanks} title="Only fills employees with no time record (not those on leave)">
                <Wand2 className="size-4" /> Fill {blanksToFill} blank{blanksToFill > 1 ? 's' : ''} with {data.shift.timeIn}–{data.shift.timeOut}
              </Button>
            )}
            <Button
              variant="soft"
              size="sm"
              disabled={!allRows.length}
              onClick={() => downloadCsv(`time-records-${date}.csv`, timeRecordTemplate(date, allRows))}
            >
              <Download className="size-4" /> {editable ? 'Template' : 'Export'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-b-card">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-bg/60 text-xs text-muted">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Employee</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                {punchKeys.map((k) => (
                  <th key={k} className="px-2 py-3 text-left font-semibold">
                    {punchLabels[k]}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold">Late</th>
                <th className="px-3 py-3 text-right font-semibold">Hours</th>
                <th className="w-10 pr-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-5 py-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))}
              {visible.map((r) => {
                const p = current(r)
                const dirty = !!drafts[r.employeeId] && !samePunches(drafts[r.employeeId], r)
                const error = dirty ? punchError(p) : null
                const st = statusBadge[r.status]
                return (
                  <tr key={r.employeeId} className={cn('transition-colors', dirty && 'bg-primary-50/50', error && 'bg-danger-50/60')}>
                    <td className="px-5 py-2.5">
                      <span className="block font-semibold text-navy">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        {r.employeeNo}
                        {r.source && <span className="text-muted/80">· {sourceLabel[r.source]}</span>}
                        {r.cutoffOverridden && (
                          <span title="This employee’s cut-off totals were set directly on the Cut-off summary tab, so daily changes won’t affect their pay until that is reset.">
                            <Info className="size-3.5 text-warning" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {dirty ? (
                        <Badge size="sm" tone={error ? 'danger' : 'primary'}>
                          {error ? 'Check times' : 'Unsaved'}
                        </Badge>
                      ) : (
                        <Badge size="sm" tone={st.tone}>
                          {st.label}
                        </Badge>
                      )}
                    </td>
                    {punchKeys.map((k) => (
                      <td key={k} className="px-2 py-2">
                        {editable ? (
                          <input
                            type="time"
                            value={p[k] ?? ''}
                            onChange={(e) => setPunch(r, k, e.target.value)}
                            aria-label={`${punchLabels[k]} for ${r.name}`}
                            className={cn(
                              'w-[7.5rem] rounded-lg border bg-surface px-2 py-1.5 text-sm text-navy tabular-nums transition focus:border-primary focus:ring-4 focus:ring-primary-100 focus:outline-none',
                              error ? 'border-danger' : dirty && (p[k] ?? null) !== (r[k] ?? null) ? 'border-primary' : 'border-line',
                            )}
                          />
                        ) : (
                          <span className="tabular-nums text-ink">{p[k] ?? <span className="text-line">—</span>}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {dirty ? (
                        <span className="text-muted">…</span>
                      ) : r.lateMinutes ? (
                        <span className="font-semibold text-warning">{r.lateMinutes}m</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                      {dirty ? <span className="text-muted">…</span> : r.hoursWorked || <span className="text-muted">0</span>}
                    </td>
                    <td className="pr-5 text-right">
                      {editable && punchKeys.some((k) => p[k]) && (
                        <button
                          type="button"
                          title="Clear this day’s times"
                          aria-label={`Clear times for ${r.name}`}
                          onClick={() => setDrafts((d) => ({ ...d, [r.employeeId]: { ...emptyPunches } }))}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-danger-50 hover:text-danger"
                        >
                          <Eraser className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!isLoading && !visible.length && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-muted">
                    {allRows.length ? 'No employee matches your search or filter.' : 'No active employees on this day.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Save bar */}
      <AnimatePresence>
        {changed.length > 0 && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="sticky bottom-20 z-30 mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5 shadow-float lg:bottom-6"
          >
            <p className="text-sm text-ink">
              <b className="text-navy">{changed.length}</b> unsaved change{changed.length > 1 ? 's' : ''}
              {invalid.length > 0 && (
                <span className="text-danger">
                  {' '}
                  · fix {invalid.length} row{invalid.length > 1 ? 's' : ''} marked in red
                </span>
              )}
              {data?.period?.status === 'computed' && (
                <span className="text-warning"> · saving sends the {data.period.label} payroll back to Draft</span>
              )}
            </p>
            {save.isError && !importing && <p className="text-sm text-danger">{save.error.message}</p>}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDrafts({})} disabled={save.isPending}>
                Discard
              </Button>
              <Button size="sm" onClick={saveChanges} disabled={save.isPending || invalid.length > 0}>
                {save.isPending ? 'Saving…' : 'Save time records'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-primary-50/90 backdrop-blur-sm">
          <p className="flex items-center gap-3 text-lg font-bold text-primary">
            <FileUp className="size-7" /> Drop to import time records
          </p>
        </div>
      )}
    </div>
  )
}

function ImportResult({ outcome: o, viewing, onClose }: { outcome: NonNullable<ImportOutcome>; viewing: string; onClose: () => void }) {
  const ok = o.saved > 0
  const span =
    o.dates.length > 1
      ? `${formatDate(o.dates[0], 'MMM d')} – ${formatDate(o.dates[o.dates.length - 1], 'MMM d')}`
      : o.dates[0] && formatDate(o.dates[0], 'MMM d')
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn('mb-5 rounded-2xl border px-5 py-4', ok ? 'border-success/30 bg-success-50' : 'border-danger/30 bg-danger-50')}
    >
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className={cn('font-semibold', ok ? 'text-success' : 'text-danger')}>
            {ok ? `Imported ${o.saved} time record${o.saved > 1 ? 's' : ''}${span ? ` for ${span}` : ''}` : `Nothing imported from ${o.file}`}
          </p>
          <p className="mt-0.5 text-ink">
            {[
              o.skipped && `${o.skipped} row${o.skipped > 1 ? 's' : ''} skipped`,
              o.blank && `${o.blank} without times ignored`,
              ok && o.dates.some((d) => d !== viewing) && 'switch days to see the others',
            ]
              .filter(Boolean)
              .join(' · ') || o.file}
          </p>
          {o.errors.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-danger">
              {o.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-lg p-1 text-muted hover:bg-surface/60">
          <X className="size-4" />
        </button>
      </div>
    </motion.div>
  )
}
