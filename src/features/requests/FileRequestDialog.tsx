import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { useEmployees, useFileRequest } from '@/services/queries'
import type { FilingKind } from '@/services/types'
import { manilaToday } from '@/lib/timeRecords'
import { buildFilingData, filingEffect, filingLabels, type FilingForm } from './filings'

const kinds: FilingKind[] = ['no_dtr', 'dtr_discrepancy', 'undertime', 'official_business', 'overtime']

/**
 * HR files a time filing on an employee's behalf (e.g. a biometric outage, or someone without AZONE access).
 * "Approve now" files and approves in one step, since HR is the approver.
 */
export function FileRequestDialog({ onClose }: { onClose: () => void }) {
  const employees = useEmployees()
  const file = useFileRequest()
  const today = manilaToday()
  const [employeeId, setEmployeeId] = useState('')
  const [reason, setReason] = useState('')
  const [approve, setApprove] = useState(true)
  const [f, setF] = useState<FilingForm>({
    kind: 'no_dtr',
    date: today,
    endDate: '',
    timeIn: '08:00',
    breakOut: '12:00',
    breakIn: '13:00',
    timeOut: '17:00',
    timeFrom: '',
    timeTo: '',
    location: '',
    hours: '',
  })
  const set = (k: keyof FilingForm) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const built = buildFilingData(f, today)
  const error = !employeeId ? 'Pick an employee' : 'error' in built ? built.error : reason.trim().length < 5 ? 'Give a reason (at least 5 characters)' : null
  const [tried, setTried] = useState(false)
  const timeKinds = f.kind === 'dtr_discrepancy' || f.kind === 'no_dtr'

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="File for an employee" description="Time filings HR enters on someone’s behalf">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (error || 'error' in built) return
          file.mutate({ employeeId, kind: f.kind, details: reason.trim(), data: built.data, approve }, { onSuccess: onClose })
        }}
      >
        <div className="col-span-2">
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
        </div>
        <div className="col-span-2">
          <Field label="Filing">
            <Select value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as FilingKind }))}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {filingLabels[k]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="mt-1.5 text-xs text-muted">{filingEffect[f.kind]}</p>
        </div>

        <Field label={f.kind === 'official_business' ? 'From' : 'Date'}>
          <Input type="date" max={f.kind === 'official_business' ? undefined : today} value={f.date} onChange={set('date')} />
        </Field>
        {f.kind === 'official_business' ? (
          <Field label="To">
            <Input type="date" min={f.date} value={f.endDate || f.date} onChange={set('endDate')} />
          </Field>
        ) : f.kind === 'undertime' ? (
          <Field label="Left at">
            <Input type="time" value={f.timeOut} onChange={set('timeOut')} />
          </Field>
        ) : f.kind === 'overtime' ? (
          <Field label="Overtime hours">
            <Input type="number" min={0.5} max={16} step={0.5} inputMode="decimal" placeholder="e.g. 2" value={f.hours} onChange={set('hours')} />
          </Field>
        ) : (
          <div />
        )}

        {timeKinds && (
          <>
            <Field label="Time in">
              <Input type="time" value={f.timeIn} onChange={set('timeIn')} />
            </Field>
            <Field label="Time out">
              <Input type="time" value={f.timeOut} onChange={set('timeOut')} />
            </Field>
            <Field label="Break out (optional)">
              <Input type="time" value={f.breakOut} onChange={set('breakOut')} />
            </Field>
            <Field label="Break in (optional)">
              <Input type="time" value={f.breakIn} onChange={set('breakIn')} />
            </Field>
          </>
        )}
        {f.kind === 'official_business' && (
          <>
            <Field label="Time from (optional)">
              <Input type="time" value={f.timeFrom} onChange={set('timeFrom')} />
            </Field>
            <Field label="Time to (optional)">
              <Input type="time" value={f.timeTo} onChange={set('timeTo')} />
            </Field>
            <div className="col-span-2">
              <Field label="Place">
                <Input placeholder="e.g. Pier 4, Cebu City" value={f.location} onChange={set('location')} />
              </Field>
            </div>
          </>
        )}

        <div className="col-span-2">
          <Field label="Reason">
            <Textarea className="min-h-16" placeholder="e.g. Biometric device was down" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          Approve now (otherwise it waits in the inbox)
        </label>

        {((tried && error) || file.error) && <p className="col-span-2 text-sm text-danger">{file.error?.message ?? error}</p>}
        <Button type="submit" className="col-span-2" disabled={file.isPending}>
          {approve ? <Check className="size-4" /> : <Send className="size-4" />}
          {file.isPending ? 'Saving…' : approve ? 'File & approve' : 'File'}
        </Button>
      </form>
    </Dialog>
  )
}
