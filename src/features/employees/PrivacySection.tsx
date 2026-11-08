import { useState } from 'react'
import { Download, ShieldCheck, ShieldOff } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { formatDate } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { downloadJson, platformApi, useEmployeePrivacy, usePrivacyMutations } from '@/services/platform'
import type { EmployeeProfile } from '@/services/types'
import { useAuth } from '@/store/auth'

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Employee → Privacy tab (checklist #86): consent status, a copy of their data, and erasure after retention. */
export function PrivacySection({ employee: e, canManage }: { employee: EmployeeProfile; canManage: boolean }) {
  const { data } = useEmployeePrivacy(e.id)
  const isHr = useAuth((s) => s.session?.user.role) === 'hr'
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [erasing, setErasing] = useState(false)

  if (!data) return <Skeleton className="h-48" />
  const current = data.consentVersion === data.currentVersion
  const canErase = !!data.erasableFrom && data.erasableFrom <= manilaToday() && !data.anonymizedAt

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <CardHeader icon={ShieldCheck} title="Privacy notice" />
        <div className="mt-4 flex items-center gap-2 text-sm">
          {data.anonymizedAt ? (
            <Badge tone="neutral">Erased {formatDate(data.anonymizedAt.slice(0, 10))}</Badge>
          ) : current ? (
            <Badge tone="success">Acknowledged</Badge>
          ) : data.consentAt ? (
            <Badge tone="warning">Older version</Badge>
          ) : (
            <Badge tone="warning">Not yet</Badge>
          )}
          <span className="text-muted">
            {data.consentAt
              ? `Version ${data.consentVersion} on ${new Date(data.consentAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`
              : `They’ll be asked to acknowledge version ${data.currentVersion} in AZONE.`}
          </span>
        </div>
        <p className="mt-4 text-xs text-muted">
          Under the Data Privacy Act an employee may ask for a copy of the personal data APAY holds about them. The download includes their profile, 201 records,
          attendance, leaves, requests, payslips, loans and sea service (no passwords). It’s recorded in the audit trail.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {canManage && !data.anonymizedAt && (
          <Button
            className="mt-4"
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              setError(null)
              try {
                const d = await platformApi.exportPersonalData(e.id)
                downloadJson(d, `personal-data-${d.subject.employeeNo}-${manilaToday()}.json`)
              } catch (err) {
                setError(errorText(err))
              } finally {
                setExporting(false)
              }
            }}
          >
            <Download className="size-4" /> {exporting ? 'Preparing…' : 'Download their data'}
          </Button>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={ShieldOff} title="Retention & erasure" />
        <p className="mt-3 text-sm text-ink">
          Records are kept for {data.retentionYears} years after separation (BIR, SSS and DOLE audits). After that, HR can erase this person’s identity:
          profile details, 201 records, photo, AZONE login and notifications are deleted; payslips and attendance stay without their name.
        </p>
        <p className="mt-3 text-sm text-muted">
          {data.anonymizedAt
            ? 'Personal data has been erased.'
            : data.erasableFrom
              ? data.erasableFrom <= manilaToday()
                ? `Retention period ended on ${formatDate(data.erasableFrom)}.`
                : `Can be erased from ${formatDate(data.erasableFrom)}.`
              : 'Only separated employees can be erased.'}
        </p>
        {isHr && canErase && (
          <Button className="mt-4 bg-danger hover:bg-danger/90" onClick={() => setErasing(true)}>
            <ShieldOff className="size-4" /> Erase personal data
          </Button>
        )}
      </Card>
      {erasing && <EraseDialog employee={e} onClose={() => setErasing(false)} />}
    </div>
  )
}

function EraseDialog({ employee: e, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const { anonymize } = usePrivacyMutations()
  const [confirm, setConfirm] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Erase ${e.fullName}?`} description="This can’t be undone.">
      <form
        className="space-y-3"
        onSubmit={async (ev) => {
          ev.preventDefault()
          await anonymize.mutateAsync({ id: e.id, confirm })
          onClose()
        }}
      >
        <Field label={`Type the employee no. (${e.employeeNo}) to confirm`}>
          <Input value={confirm} onChange={(ev) => setConfirm(ev.target.value)} autoComplete="off" />
        </Field>
        {anonymize.isError && <p className="text-sm text-danger">{errorText(anonymize.error)}</p>}
        <Button type="submit" className="w-full bg-danger hover:bg-danger/90" disabled={confirm.trim() !== e.employeeNo || anonymize.isPending}>
          {anonymize.isPending ? 'Erasing…' : 'Erase personal data'}
        </Button>
      </form>
    </Dialog>
  )
}
