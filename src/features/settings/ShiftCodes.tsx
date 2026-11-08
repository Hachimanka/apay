import { useState } from 'react'
import { Clock3, Moon, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useDeleteShift, useSaveShift, useShifts } from '@/services/queries'
import type { Shift, ShiftInput } from '@/services/types'
import { cn } from '@/lib/cn'

export const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 480 → "8:00 AM" */
export function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const toHHmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromHHmm = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : NaN)

/** Overlaps 10 PM – 6 AM (night differential applies). */
export const isNightShift = (s: Pick<Shift, 'startMinutes' | 'endMinutes'>) => s.endMinutes < s.startMinutes || s.startMinutes < 360 || s.endMinutes > 1320

export const shiftSummary = (s: Pick<Shift, 'startMinutes' | 'endMinutes' | 'restDays'>) =>
  `${clockLabel(s.startMinutes)} – ${clockLabel(s.endMinutes)}${s.endMinutes < s.startMinutes ? ' (next day)' : ''} · Rest ${
    s.restDays.length ? [...s.restDays].sort().map((d) => weekdayShort[d]).join(', ') : 'none'
  }`

/** Settings → Shifts: shift codes assigned to employees (lates, rest days and night hours follow the shift). */
export function ShiftCodes({ canManage, defaultStart }: { canManage: boolean; defaultStart: number }) {
  const { data } = useShifts()
  const [editing, setEditing] = useState<ShiftInput | null>(null)
  const [deleting, setDeleting] = useState<Shift | null>(null)

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={Clock3}
        title="Shift codes"
        action={
          canManage && (
            <Button
              size="sm"
              variant="soft"
              onClick={() => setEditing({ code: '', name: '', startMinutes: 480, endMinutes: 1020, breakMinutes: 60, restDays: [0, 6], active: true })}
            >
              <Plus className="size-4" /> Add
            </Button>
          )
        }
      />
      <p className="mt-2 text-xs text-muted">
        Lates are measured from the shift start, and rest days follow the shift. Hours between 10 PM and 6 AM earn night differential (110%).
        Employees without a shift use the company default: {clockLabel(defaultStart)} – {clockLabel((defaultStart + 540) % 1440)}, Mon–Fri.
      </p>
      {!data ? (
        <Skeleton className="mt-4 h-32" />
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted italic">No shift codes yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {data.map((s) => (
            <li key={s.id} className={cn('flex items-center gap-3 py-2.5', !s.active && 'opacity-60')}>
              <Badge size="sm" tone="neutral" className="w-16 justify-center">
                {s.code}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-navy">
                  {s.name}
                  {isNightShift(s) && <Moon className="size-3.5 text-violet" aria-label="Night differential applies" />}
                  {!s.active && <span className="text-xs font-normal text-muted">(inactive)</span>}
                </span>
                <span className="block text-xs text-muted">{shiftSummary(s)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {s.employees} employee{s.employees === 1 ? '' : 's'}
              </span>
              {canManage && (
                <span className="flex shrink-0">
                  <button aria-label={`Edit ${s.code}`} className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-primary" onClick={() => setEditing(s)}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button aria-label={`Delete ${s.code}`} className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-danger" onClick={() => setDeleting(s)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <ShiftDialog initial={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteShift shift={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  )
}

function ShiftDialog({ initial, onClose }: { initial: ShiftInput; onClose: () => void }) {
  const save = useSaveShift()
  const [s, setS] = useState<ShiftInput>({ ...initial, restDays: [...initial.restDays] })
  const span = (s.endMinutes - s.startMinutes + 1440) % 1440
  const invalid = !/^[A-Za-z0-9_-]{1,12}$/.test(s.code.trim())
    ? 'Code: up to 12 letters, numbers, - or _'
    : s.name.trim().length < 2
      ? 'Enter a name'
      : Number.isNaN(s.startMinutes) || Number.isNaN(s.endMinutes)
        ? 'Enter start and end times'
        : span === 0
          ? 'Start and end can’t be the same'
          : s.breakMinutes >= span
            ? 'The break is longer than the shift'
            : null
  const toggleDay = (d: number) => setS({ ...s, restDays: s.restDays.includes(d) ? s.restDays.filter((x) => x !== d) : [...s.restDays, d] })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={initial.id ? `Edit ${initial.code}` : 'Add shift code'}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (invalid) return
          await save.mutateAsync({ ...s, code: s.code.trim().toUpperCase(), name: s.name.trim() })
          onClose()
        }}
      >
        <Field label="Code">
          <Input value={s.code} placeholder="e.g. NIGHT" maxLength={12} onChange={(e) => setS({ ...s, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Name">
          <Input value={s.name} placeholder="e.g. Night shift" onChange={(e) => setS({ ...s, name: e.target.value })} />
        </Field>
        <Field label="Start">
          <Input type="time" value={toHHmm(s.startMinutes)} onChange={(e) => setS({ ...s, startMinutes: fromHHmm(e.target.value) })} />
        </Field>
        <Field label="End">
          <Input type="time" value={toHHmm(s.endMinutes)} onChange={(e) => setS({ ...s, endMinutes: fromHHmm(e.target.value) })} />
        </Field>
        <Field label="Break (minutes)">
          <Input type="number" min={0} max={240} value={s.breakMinutes} onChange={(e) => setS({ ...s, breakMinutes: Number(e.target.value) })} />
        </Field>
        <Field label="Paid hours">
          <Input value={Number.isNaN(span) ? '—' : `${((span - s.breakMinutes) / 60).toFixed(1)} h${s.endMinutes < s.startMinutes ? ' · ends next day' : ''}`} disabled />
        </Field>
        <div className="col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-navy">Rest days</span>
          <div className="flex flex-wrap gap-1.5">
            {weekdayShort.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={s.restDays.includes(i)}
                onClick={() => toggleDay(i)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                  s.restDays.includes(i) ? 'border-primary bg-primary text-white' : 'border-line text-muted hover:border-primary-200',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {initial.id && (
          <label className="col-span-2 flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" className="size-4 accent-primary" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} />
            Active (inactive shifts can’t be assigned to more employees)
          </label>
        )}
        <p className="col-span-2 text-xs text-muted">Changes apply to payrolls computed from now on — recompute an open cut-off to use them.</p>
        {(save.isError || (invalid && (s.code || s.name))) && <p className="col-span-2 text-sm text-danger">{save.error?.message ?? invalid}</p>}
        <Button type="submit" className="col-span-2" disabled={save.isPending || !!invalid}>
          {save.isPending ? 'Saving…' : initial.id ? 'Save changes' : 'Add shift'}
        </Button>
      </form>
    </Dialog>
  )
}

function DeleteShift({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const del = useDeleteShift()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Delete ${shift.code}?`} description={shift.name}>
      <p className="mb-4 text-sm text-muted">
        {shift.employees ? `${shift.employees} employee(s) still use this shift — reassign them first, or edit it and mark it inactive.` : 'This shift code will be removed.'}
      </p>
      {del.isError && <p className="mb-2 text-sm text-danger">{del.error.message}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-danger hover:bg-danger/90"
          disabled={del.isPending || shift.employees > 0}
          onClick={async () => {
            await del.mutateAsync(shift.id)
            onClose()
          }}
        >
          {del.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </Dialog>
  )
}
