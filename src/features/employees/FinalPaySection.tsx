import { useEffect, useState } from 'react'
import { CheckCircle2, Plus, Printer, RotateCcw, ShieldCheck, Trash2, Undo2, UserMinus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select } from '@/components/ui/Field'
import { useFinalPay, useFinalPayMutations } from '@/services/queries'
import type { ClearanceItem, EmployeeProfile, FinalPay, FinalPayItem, SeparationReason } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { formatDate, formatPeso } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'

export const separationReasonLabels: Record<SeparationReason, string> = {
  resignation: 'Resignation',
  end_of_contract: 'End of contract',
  termination: 'Termination',
  retirement: 'Retirement',
  redundancy: 'Redundancy',
  death: 'Death',
  other: 'Other',
}

const statusTone = { draft: 'warning', approved: 'primary', released: 'success' } as const

/** Net final pay from the ticked items */
export function finalNet(earnings: FinalPayItem[], deductions: FinalPayItem[]) {
  const t = (xs: FinalPayItem[]) => xs.filter((x) => x.included).reduce((s, x) => s + Number(x.amount), 0)
  return (t(earnings) - t(deductions)).toFixed(2)
}

/**
 * Clearance & final pay (checklist #36). HR sets the last day; APAY computes the unpaid salary, prorated 13th month,
 * unused VL, the year-end tax adjustment and unpaid loans. HR can untick items, add their own and work through the
 * clearance checklist, then approve and release.
 */
export function FinalPaySection({ employee }: { employee: EmployeeProfile }) {
  const { data: fp, isLoading } = useFinalPay(employee.id)
  const m = useFinalPayMutations(employee.id)
  const role = useAuth((s) => s.session?.user.role)
  const canProcess = can(role, 'payroll.process')
  const canApprove = can(role, 'payroll.approve')
  const [date, setDate] = useState(manilaToday())
  const [reason, setReason] = useState<SeparationReason>('resignation')
  const [draft, setDraft] = useState<Pick<FinalPay, 'earnings' | 'deductions' | 'clearance'> | null>(null)

  useEffect(() => {
    if (fp) {
      setDraft({ earnings: fp.earnings, deductions: fp.deductions, clearance: fp.clearance })
      setDate(fp.separationDate)
    } else setDraft(null)
  }, [fp])

  const error = m.compute.error ?? m.save.error ?? m.status.error ?? m.remove.error
  if (isLoading) return <Card className="p-6 text-sm text-muted">Loading…</Card>

  if (!fp || !draft)
    return (
      <Card className="max-w-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-danger-50 p-2.5 text-danger">
            <UserMinus className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-navy">Clearance & final pay</p>
            <p className="text-sm text-muted">When {employee.firstName} leaves, set the last day of work to compute the final pay.</p>
          </div>
        </div>
        {canProcess ? (
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              m.compute.mutate({ separationDate: date, separationReason: reason })
            }}
          >
            <Field label="Last day of work">
              <Input type="date" min={employee.hireDate} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value as SeparationReason)}>
                {(Object.keys(separationReasonLabels) as SeparationReason[]).map((r) => (
                  <option key={r} value={r}>
                    {separationReasonLabels[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="col-span-2 text-xs text-muted">
              From then on {employee.firstName} is paid through the final pay, not the regular payroll. You can remove the draft if the
              separation is cancelled.
            </p>
            {error && <p className="col-span-2 text-sm text-danger">{error.message}</p>}
            <Button type="submit" className="col-span-2" disabled={m.compute.isPending}>
              {m.compute.isPending ? 'Computing…' : 'Compute final pay'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted">No final pay yet.</p>
        )}
      </Card>
    )

  const editable = fp.status === 'draft' && canProcess
  const dirty = JSON.stringify(draft) !== JSON.stringify({ earnings: fp.earnings, deductions: fp.deductions, clearance: fp.clearance })
  const net = finalNet(draft.earnings, draft.deductions)
  const clearanceDone = draft.clearance.every((c) => c.done)

  const setItems = (side: 'earnings' | 'deductions', items: FinalPayItem[]) => setDraft((d) => d && { ...d, [side]: items })
  const setClearance = (items: ClearanceItem[]) => setDraft((d) => d && { ...d, clearance: items })

  return (
    <div className="space-y-5 print:space-y-3">
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <p className="flex items-center gap-2 font-semibold text-navy">
            Final pay <Badge tone={statusTone[fp.status]}>{fp.status}</Badge>
          </p>
          <p className="text-sm text-muted">
            Last day {formatDate(fp.separationDate)}
            {employee.separationReason ? ` · ${separationReasonLabels[employee.separationReason as SeparationReason] ?? employee.separationReason}` : ''}
            {fp.approvedBy && ` · approved by ${fp.approvedBy}`}
            {fp.releasedAt && ` · released ${formatDate(fp.releasedAt)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Net final pay</p>
          <p className={cn('text-2xl font-extrabold tabular-nums', Number(net) < 0 ? 'text-danger' : 'text-primary')}>{formatPeso(net)}</p>
        </div>
      </Card>

      {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">{error.message}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <ItemList title="Earnings" items={draft.earnings} editable={editable} onChange={(x) => setItems('earnings', x)} />
        <ItemList title="Deductions" items={draft.deductions} editable={editable} onChange={(x) => setItems('deductions', x)} negative />
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold text-navy">
          Clearance checklist{' '}
          <span className="text-sm font-normal text-muted">
            {draft.clearance.filter((c) => c.done).length} of {draft.clearance.length} done
          </span>
        </p>
        <ul className="space-y-2">
          {draft.clearance.map((c, i) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                disabled={fp.status === 'released' || !canProcess}
                checked={c.done}
                onChange={(e) => setClearance(draft.clearance.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
                aria-label={c.label}
              />
              <span className={cn('flex-1', c.done ? 'text-muted line-through' : 'text-ink')}>{c.label}</span>
              {editable && c.key.startsWith('manual_') && (
                <button type="button" aria-label={`Remove ${c.label}`} onClick={() => setClearance(draft.clearance.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4 text-muted hover:text-danger" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && <AddClearance onAdd={(label) => setClearance([...draft.clearance, { key: `manual_${Date.now()}`, label, done: false }])} />}
      </Card>

      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold text-navy">How it was computed</p>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {[
            ['Unpaid salary from', fp.basis.salaryFrom],
            ['Paid days', fp.basis.paidDays],
            ['Daily rate', fp.basis.dailyRate && formatPeso(String(fp.basis.dailyRate))],
            ['Basic earned this year', fp.basis.basicEarnedYtd && formatPeso(String(fp.basis.basicEarnedYtd))],
            ['13th month already paid', fp.basis.thirteenthPaidYtd && formatPeso(String(fp.basis.thirteenthPaidYtd))],
            ['Taxable income this year (incl. final pay)', fp.basis.annualTaxable && formatPeso(String(fp.basis.annualTaxable))],
            ['Tax due for the year', fp.basis.annualTaxDue && formatPeso(String(fp.basis.annualTaxDue))],
            ['Tax withheld so far', fp.basis.taxWithheldYtd && formatPeso(String(fp.basis.taxWithheldYtd))],
          ]
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 border-b border-line py-1">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium text-navy tabular-nums">{String(v)}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          The tax adjustment covers pay from Aznar only; income from a previous employer this year isn’t included.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 print:hidden">
        {editable && (
          <>
            <Button disabled={!dirty || m.save.isPending} onClick={() => m.save.mutate(draft)}>
              {m.save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="outline" disabled={m.compute.isPending || dirty} onClick={() => m.compute.mutate({ separationDate: fp.separationDate })}>
              <RotateCcw className="size-4" /> Recompute
            </Button>
            <Button variant="outline" disabled={m.remove.isPending} onClick={() => m.remove.mutate()}>
              <Trash2 className="size-4" /> Remove draft
            </Button>
          </>
        )}
        {fp.status !== 'draft' && fp.status !== 'released' && canProcess && dirty && (
          <Button disabled={m.save.isPending} onClick={() => m.save.mutate(draft)}>
            Save checklist
          </Button>
        )}
        {fp.status === 'draft' && canApprove && (
          <Button
            variant="soft"
            disabled={dirty || !clearanceDone || m.status.isPending}
            title={!clearanceDone ? 'Finish the clearance checklist first' : undefined}
            onClick={() => m.status.mutate('approved')}
          >
            <ShieldCheck className="size-4" /> Approve
          </Button>
        )}
        {fp.status === 'approved' && canApprove && (
          <>
            <Button variant="outline" disabled={m.status.isPending} onClick={() => m.status.mutate('draft')}>
              <Undo2 className="size-4" /> Return to draft
            </Button>
            <Button disabled={m.status.isPending} onClick={() => m.status.mutate('released')}>
              <CheckCircle2 className="size-4" /> Release final pay
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>
      {fp.status === 'approved' && (
        <p className="text-xs text-muted">Releasing settles the loans deducted here, stops allowances and marks {employee.firstName} as resigned.</p>
      )}
    </div>
  )
}

function ItemList({
  title,
  items,
  editable,
  onChange,
  negative,
}: {
  title: string
  items: FinalPayItem[]
  editable: boolean
  onChange: (items: FinalPayItem[]) => void
  negative?: boolean
}) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const total = items.filter((x) => x.included).reduce((s, x) => s + Number(x.amount), 0)
  const valid = label.trim().length >= 2 && /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0
  return (
    <Card className="p-5">
      <p className="mb-3 text-[11px] font-bold tracking-wider text-muted uppercase">{title}</p>
      <ul className="space-y-2 text-sm">
        {items.map((x, i) => (
          <li key={x.key} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={x.included}
              disabled={!editable}
              onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, included: e.target.checked } : y)))}
              aria-label={`Include ${x.label}`}
            />
            <span className="flex-1">
              <span className={cn('block', x.included ? 'text-ink' : 'text-muted line-through')}>{x.label}</span>
              {x.note && <span className="block text-xs text-muted">{x.note}</span>}
            </span>
            <span className={cn('tabular-nums', x.included ? 'text-navy' : 'text-muted')}>
              {negative ? '−' : ''}
              {formatPeso(x.amount)}
            </span>
            {editable && x.key.startsWith('manual_') && (
              <button type="button" aria-label={`Remove ${x.label}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="size-4 text-muted hover:text-danger" />
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="text-muted">None</li>}
      </ul>
      <p className="mt-3 flex justify-between border-t border-line pt-2 text-sm font-bold text-navy">
        <span>Total</span>
        <span className="tabular-nums">{formatPeso(total.toFixed(2))}</span>
      </p>
      {editable && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onChange([...items, { key: `manual_${Date.now()}`, label: label.trim(), amount: Number(amount).toFixed(2), included: true }])
            setLabel('')
            setAmount('')
          }}
        >
          <Input className="flex-1 py-2" placeholder={negative ? 'e.g. Unreturned laptop charger' : 'e.g. Separation pay'} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="w-28 py-2" inputMode="decimal" placeholder="₱" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button size="sm" type="submit" variant="outline" disabled={!valid} aria-label={`Add to ${title.toLowerCase()}`}>
            <Plus className="size-4" />
          </Button>
        </form>
      )}
    </Card>
  )
}

function AddClearance({ onAdd }: { onAdd: (label: string) => void }) {
  const [label, setLabel] = useState('')
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (label.trim().length < 2) return
        onAdd(label.trim())
        setLabel('')
      }}
    >
      <Input className="flex-1 py-2" placeholder="Add a clearance step…" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Button size="sm" type="submit" variant="outline" disabled={label.trim().length < 2} aria-label="Add clearance step">
        <Plus className="size-4" />
      </Button>
    </form>
  )
}
