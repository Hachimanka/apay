import { useState } from 'react'
import { ChevronDown, Mail, MailCheck, MailWarning, Send } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { usePayslipEmails, useSendPayslipEmails } from '@/services/queries'
import type { PayslipEmail, PayslipEmailCounts } from '@/services/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'

const statusLabel: Record<PayslipEmail['status'], { label: string; tone: BadgeTone }> = {
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  not_configured: { label: 'Not sent · no email server', tone: 'warning' },
}

export const countsText = (c: PayslipEmailCounts) =>
  [c.sent && `${c.sent} sent`, c.failed && `${c.failed} failed`, c.notConfigured && `${c.notConfigured} not sent (no email server)`].filter(Boolean).join(' · ') ||
  'Nobody to email'

/** The latest attempt per employee */
export function latestPerEmployee(log: PayslipEmail[]) {
  const out = new Map<string, PayslipEmail>()
  for (const e of log) if (!out.has(e.employeeId)) out.set(e.employeeId, e) // log is newest first
  return [...out.values()]
}

/**
 * Payslip emails of a released payroll (checklist #79): each employee gets a link to AZONE, never amounts.
 * Shows the send log and lets HR resend to everyone or to those whose email failed.
 */
export function PayslipEmails({ periodId, canSend }: { periodId: string; canSend: boolean }) {
  const { data } = usePayslipEmails(periodId)
  const send = useSendPayslipEmails()
  const [showLog, setShowLog] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const latest = latestPerEmployee(data?.log ?? [])
  const sent = latest.filter((e) => e.status === 'sent').length
  const failed = latest.filter((e) => e.status === 'failed')
  const resend = (employeeIds?: string[]) =>
    send.mutate({ periodId, employeeIds }, { onSuccess: (c) => setNote(countsText(c)), onError: () => setNote(null) })

  return (
    <Card className="mt-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('rounded-xl p-2.5', failed.length ? 'bg-danger-50 text-danger' : 'bg-primary-50 text-primary')}>
          {failed.length ? <MailWarning className="size-5" /> : sent ? <MailCheck className="size-5" /> : <Mail className="size-5" />}
        </span>
        <div className="mr-auto">
          <p className="font-semibold text-navy">Payslip emails</p>
          <p className="text-sm text-muted">
            {!data
              ? 'Loading…'
              : !latest.length
                ? 'No payslip emails yet.'
                : `${sent} of ${latest.length} delivered${failed.length ? ` · ${failed.length} failed` : ''}`}
            {data && !data.configured && ' No email server is set up yet, so emails are logged but not sent.'}
          </p>
        </div>
        {canSend && failed.length > 0 && (
          <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => resend(failed.map((f) => f.employeeId))}>
            <Send className="size-4" /> Retry failed
          </Button>
        )}
        {canSend && (
          <Button size="sm" variant="soft" disabled={send.isPending} onClick={() => resend()}>
            <Send className="size-4" /> {send.isPending ? 'Sending…' : latest.length ? 'Resend to all' : 'Send to all'}
          </Button>
        )}
      </div>
      {note && <p className="mt-3 rounded-xl bg-primary-50 px-4 py-2 text-sm text-primary">{note}</p>}
      {send.error && <p className="mt-3 text-sm text-danger">{send.error.message}</p>}
      {!!data?.log.length && (
        <>
          <button
            type="button"
            onClick={() => setShowLog((s) => !s)}
            aria-expanded={showLog}
            className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Send log ({data.log.length}) <ChevronDown className={cn('size-4 transition-transform', showLog && 'rotate-180')} />
          </button>
          {showLog && (
            <div className="mt-2 max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1.5 text-left font-semibold">Employee</th>
                    <th className="py-1.5 text-left font-semibold">Email</th>
                    <th className="py-1.5 text-left font-semibold">Status</th>
                    <th className="py-1.5 text-right font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.log.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 font-medium text-navy">{e.employeeName}</td>
                      <td className="py-2 text-ink">{e.email}</td>
                      <td className="py-2" title={e.error}>
                        <Badge size="sm" tone={statusLabel[e.status].tone}>
                          {statusLabel[e.status].label}
                        </Badge>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap text-muted">
                        {formatDate(e.sentAt, 'MMM d, h:mm a')}
                        {e.sentBy ? ` · ${e.sentBy}` : ' · on release'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

/** "Resend payslip email" for one employee, inside the payslip preview */
export function ResendPayslipButton({ periodId, employeeId }: { periodId: string; employeeId: string }) {
  const send = useSendPayslipEmails()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate({ periodId, employeeIds: [employeeId] })}>
        <Send className="size-4" /> {send.isPending ? 'Sending…' : 'Resend payslip email'}
      </Button>
      {send.data && <span className="text-sm text-muted">{countsText(send.data)}</span>}
      {send.error && <span className="text-sm text-danger">{send.error.message}</span>}
    </div>
  )
}
