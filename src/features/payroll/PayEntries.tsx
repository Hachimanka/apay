import { useState } from 'react'
import { Gift, Plus, Repeat, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useEmployees, usePayEntries, usePayEntryMutations } from '@/services/queries'
import type { PayEntryKind } from '@/services/types'
import { formatPeso } from '@/lib/format'
import { sum } from '@/lib/payroll'

export const payEntryLabels: Record<PayEntryKind, string> = {
  bonus: 'Bonus (counts toward the ₱90,000 exemption)',
  leave_conversion: 'Vacation leave conversion',
  other_taxable: 'Other earning — taxable',
  other_non_taxable: 'Other earning — non-taxable',
  deduction: 'One-time deduction',
  thirteenth_month: '13th month (manual)',
}

/**
 * One-time entries on a payroll (checklist #40, #42, #43): bonuses, VL conversion, other earnings and deductions.
 * Editable while the payroll is draft or computed; changing them sends a computed payroll back to draft.
 */
export function PayEntries({ periodId, editable, isDecember }: { periodId: string; editable: boolean; isDecember: boolean }) {
  const { data } = usePayEntries(periodId)
  const m = usePayEntryMutations(periodId)
  const [adding, setAdding] = useState(false)
  const entries = data ?? []
  const error = m.remove.error ?? m.convertVl.error

  if (!editable && !entries.length) return null
  return (
    <Card className="mt-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-primary-50 p-2.5 text-primary">
          <Gift className="size-5" />
        </span>
        <div className="mr-auto">
          <p className="font-semibold text-navy">One-time entries</p>
          <p className="text-sm text-muted">
            Bonuses, leave conversion and other one-off earnings or deductions for this payroll only.
            {isDecember && ' The 13th month is added automatically when this payroll is computed.'}
          </p>
        </div>
        {editable && (
          <>
            <Button size="sm" variant="outline" disabled={m.convertVl.isPending} onClick={() => m.convertVl.mutate(undefined)}>
              <Repeat className="size-4" /> {m.convertVl.isPending ? 'Converting…' : 'Convert unused VL'}
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add entry
            </Button>
          </>
        )}
      </div>
      {m.convertVl.data && <p className="mt-3 text-sm text-primary">Added leave conversion for {m.convertVl.data.added} employee(s).</p>}
      {error && <p className="mt-3 text-sm text-danger">{error.message}</p>}
      {entries.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 text-left font-semibold">Employee</th>
                <th className="py-1.5 text-left font-semibold">Entry</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2">
                    <span className="block font-medium text-navy">{e.employeeName}</span>
                    <span className="text-xs text-muted">{e.department}</span>
                  </td>
                  <td className="py-2">
                    <span className="block text-ink">{e.label}</span>
                    <Badge size="sm" tone={e.kind === 'deduction' ? 'danger' : 'success'}>
                      {e.kindLabel}
                      {e.days ? ` · ${e.days} day${e.days === 1 ? '' : 's'}` : ''}
                    </Badge>
                  </td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${e.kind === 'deduction' ? 'text-danger' : 'text-navy'}`}>
                    {e.kind === 'deduction' ? '−' : ''}
                    {formatPeso(e.amount)}
                  </td>
                  <td className="py-2 text-right">
                    {editable && (
                      <button
                        type="button"
                        onClick={() => m.remove.mutate(e.id)}
                        disabled={m.remove.isPending}
                        aria-label={`Remove ${e.label} for ${e.employeeName}`}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-danger-50 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-xs text-muted">
            Earnings {formatPeso(sum(entries.filter((e) => e.kind !== 'deduction').map((e) => e.amount)))} · Deductions{' '}
            {formatPeso(sum(entries.filter((e) => e.kind === 'deduction').map((e) => e.amount)))}
          </p>
        </div>
      )}
      {adding && <AddEntryDialog periodId={periodId} onClose={() => setAdding(false)} />}
    </Card>
  )
}

function AddEntryDialog({ periodId, onClose }: { periodId: string; onClose: () => void }) {
  const employees = useEmployees()
  const { add } = usePayEntryMutations(periodId)
  const [employeeId, setEmployeeId] = useState('')
  const [kind, setKind] = useState<PayEntryKind>('bonus')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const vl = kind === 'leave_conversion'
  const invalid = !employeeId
    ? 'Pick an employee'
    : vl
      ? !(Number(days) >= 0.5)
        ? 'Enter the days to convert'
        : null
      : !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0
        ? 'Enter an amount like 5000 or 5000.50'
        : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add one-time entry" description="Paid or deducted on this payroll only">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (invalid) return
          add.mutate(
            { employeeId, kind, label: label.trim() || undefined, amount: vl ? undefined : amount, days: vl ? Number(days) : undefined },
            { onSuccess: onClose },
          )
        }}
      >
        <Field label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoFocus>
            <option value="">Select…</option>
            {(employees.data ?? [])
              .filter((e) => e.status !== 'resigned')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} · {e.department}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as PayEntryKind)}>
            {(Object.keys(payEntryLabels) as PayEntryKind[]).map((k) => (
              <option key={k} value={k}>
                {payEntryLabels[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label (optional)">
            <Input placeholder={vl ? 'Vacation Leave Conversion' : 'e.g. Performance Bonus'} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {vl ? (
            <Field label="Days to convert">
              <Input type="number" min={0.5} step={0.5} inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          ) : (
            <Field label="Amount (₱)">
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
        </div>
        <p className="text-xs text-muted">
          {vl
            ? 'Paid at the daily rate (monthly × 12 ÷ 261). Up to 10 converted days a year are non-taxable; the days come off the vacation leave balance.'
            : kind === 'bonus' || kind === 'thirteenth_month'
              ? 'The 13th month and bonuses are tax-exempt up to ₱90,000 a year combined; anything above is taxed.'
              : kind === 'deduction'
                ? 'Deducted after tax, like a loan payment.'
                : 'Added to gross pay on this payroll.'}
        </p>
        {(add.error || invalid) && <p className="text-sm text-danger">{add.error?.message ?? invalid}</p>}
        <Button type="submit" className="w-full" disabled={add.isPending || !!invalid}>
          {add.isPending ? 'Adding…' : 'Add entry'}
        </Button>
      </form>
    </Dialog>
  )
}
