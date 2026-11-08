import { useMemo, useState } from 'react'
import { CalendarDays, Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useDeleteHoliday, useHolidays, useLoadOfficialHolidays, useSaveHoliday } from '@/services/queries'
import type { Holiday } from '@/services/types'
import { formatDate } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'

export const holidayTypeLabel = { regular: 'Regular', special: 'Special non-working' } as const

/** Settings → Holidays: the calendar attendance and holiday pay use. Pre-loaded from the proclamations; HR maintains it. */
export function HolidayCalendar({ canManage }: { canManage: boolean }) {
  const { data } = useHolidays()
  const load = useLoadOfficialHolidays()
  const today = manilaToday()
  const years = useMemo(() => [...new Set((data ?? []).map((h) => h.date.slice(0, 4)))].sort(), [data])
  const [year, setYear] = useState(today.slice(0, 4))
  const [editing, setEditing] = useState<{ holiday: Holiday; original?: string } | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)
  const shownYear = years.includes(year) ? year : (years.at(-1) ?? year)
  const rows = (data ?? []).filter((h) => h.date.startsWith(shownYear))

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={CalendarDays}
        title="Holidays"
        action={
          canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={load.isPending} onClick={() => load.mutate()} title="Add any proclaimed holidays that are missing">
                <Download className="size-4" /> {load.isPending ? 'Loading…' : 'Load official'}
              </Button>
              <Button size="sm" variant="soft" onClick={() => setEditing({ holiday: { date: `${shownYear}-01-01`, name: '', type: 'regular' } })}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          )
        }
      />
      <p className="mt-2 text-xs text-muted">
        Regular holidays: unworked days are paid; work is paid at 200%. Special non-working days: work is paid at 130%. Eid’l Fitr and Eid’l Adha
        are proclaimed separately each year — add them here once announced.
      </p>
      {load.isSuccess && (
        <p className="mt-2 text-xs font-medium text-success">
          {load.data.added ? `Added ${load.data.added} holiday${load.data.added > 1 ? 's' : ''}.` : 'The calendar already has every official holiday.'} Dates
          inside a payroll under review, approved or released are never changed.
        </p>
      )}
      {load.isError && <p className="mt-2 text-xs text-danger">{load.error.message}</p>}

      {years.length > 1 && (
        <div className="mt-4 flex gap-1" role="tablist" aria-label="Year">
          {years.map((y) => (
            <button
              key={y}
              role="tab"
              aria-selected={y === shownYear}
              onClick={() => setYear(y)}
              className={cn('rounded-lg px-3 py-1 text-sm font-semibold', y === shownYear ? 'bg-primary text-white' : 'text-muted hover:bg-primary-50 hover:text-primary')}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <Skeleton className="mt-4 h-40" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted italic">No holidays for {shownYear}. Use “Load official” or add them.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {rows.map((h) => (
            <li key={h.date} className={cn('flex items-center gap-3 py-2.5', h.date < today && 'opacity-60')}>
              <span className="w-28 shrink-0 tabular-nums text-muted">{formatDate(h.date, 'EEE, MMM d')}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-navy">{h.name}</span>
              <Badge size="sm" tone={h.type === 'regular' ? 'primary' : 'violet'}>
                {h.type === 'regular' ? 'Regular' : 'Special'}
              </Badge>
              {canManage && (
                <span className="flex shrink-0">
                  <button aria-label={`Edit ${h.name}`} className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-primary" onClick={() => setEditing({ holiday: h, original: h.date })}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button aria-label={`Remove ${h.name}`} className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-danger" onClick={() => setDeleting(h)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && <HolidayDialog initial={editing.holiday} original={editing.original} onClose={() => setEditing(null)} />}
      {deleting && <DeleteHoliday holiday={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  )
}

function HolidayDialog({ initial, original, onClose }: { initial: Holiday; original?: string; onClose: () => void }) {
  const save = useSaveHoliday()
  const [h, setH] = useState(initial)
  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(h.date) ? 'Pick a date' : h.name.trim().length < 2 ? 'Enter the holiday name' : null
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={original ? 'Edit holiday' : 'Add holiday'}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (invalid) return
          await save.mutateAsync({ input: { ...h, name: h.name.trim() }, originalDate: original })
          onClose()
        }}
      >
        <Field label="Date">
          <Input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={h.type} onChange={(e) => setH({ ...h, type: e.target.value as Holiday['type'] })}>
            <option value="regular">{holidayTypeLabel.regular}</option>
            <option value="special">{holidayTypeLabel.special}</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Name">
            <Input value={h.name} placeholder="e.g. Eid’l Fitr" onChange={(e) => setH({ ...h, name: e.target.value })} />
          </Field>
        </div>
        <p className="col-span-2 text-xs text-muted">A computed payroll for that cut-off goes back to Draft so it’s recomputed with this calendar.</p>
        {(save.isError || (invalid && h.name)) && <p className="col-span-2 text-sm text-danger">{save.error?.message ?? invalid}</p>}
        <Button type="submit" className="col-span-2" disabled={save.isPending || !!invalid}>
          {save.isPending ? 'Saving…' : original ? 'Save changes' : 'Add holiday'}
        </Button>
      </form>
    </Dialog>
  )
}

function DeleteHoliday({ holiday, onClose }: { holiday: Holiday; onClose: () => void }) {
  const del = useDeleteHoliday()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Remove ${holiday.name}?`} description={formatDate(holiday.date, 'EEEE, MMMM d, yyyy')}>
      <p className="mb-4 text-sm text-muted">The day becomes an ordinary workday for attendance and pay.</p>
      {del.isError && <p className="mb-2 text-sm text-danger">{del.error.message}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-danger hover:bg-danger/90"
          disabled={del.isPending}
          onClick={async () => {
            await del.mutateAsync(holiday.date)
            onClose()
          }}
        >
          {del.isPending ? 'Removing…' : 'Remove'}
        </Button>
      </div>
    </Dialog>
  )
}
