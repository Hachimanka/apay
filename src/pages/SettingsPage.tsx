import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, History, KeyRound, Save, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/Misc'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAudit, useSaveSettings, useSettings } from '@/services/queries'
import type { PayrollSettings } from '@/services/types'
import { rolePermissions, type Permission } from '@/lib/permissions'

const permissionLabels: Record<Permission, string> = {
  'employees.manage': 'Manage employees',
  'attendance.manage': 'Manage attendance',
  'payroll.process': 'Compute payroll',
  'payroll.approve': 'Approve payroll',
  'payroll.release': 'Release payroll',
  'adjustments.manage': 'Manage allowances & deductions',
  'overtime.decide': 'Approve overtime',
  'reports.view': 'View reports',
  'announcements.manage': 'Post announcements',
  'settings.manage': 'Change settings',
}

export function SettingsPage() {
  const { data } = useSettings()
  const audit = useAudit()
  const save = useSaveSettings()
  const { register, handleSubmit, reset, formState } = useForm<PayrollSettings>()

  useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" description="Payroll rules, access control and the audit trail." />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <CardHeader icon={SlidersHorizontal} title="Payroll rules" />
          {!data ? (
            <Skeleton className="mt-4 h-64" />
          ) : (
            <form
              onSubmit={handleSubmit((v) => save.mutate({ ...v, graceMinutes: Number(v.graceMinutes), roundLateTo: Number(v.roundLateTo) }))}
              className="mt-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company name">
                  <Input {...register('companyName')} />
                </Field>
                <Field label="Pay frequency">
                  <Input value="Semi-monthly" disabled />
                </Field>
                <Field label="1st cut-off">
                  <Input value={`Days ${data.firstCutoff.start}–${data.firstCutoff.end}, paid on the ${data.firstCutoff.payDay}th`} disabled />
                </Field>
                <Field label="2nd cut-off">
                  <Input value={`Day ${data.secondCutoff.start}–end, paid on the last day`} disabled />
                </Field>
                <Field label="Late grace period (minutes)">
                  <Input type="number" min={0} {...register('graceMinutes')} />
                </Field>
                <Field label="Round late minutes to">
                  <Input type="number" min={1} {...register('roundLateTo')} />
                </Field>
              </div>
              <Toggle label="Publish released payslips to AZONE automatically" {...register('autoPublishToAzone')} />
              <Button type="submit" disabled={save.isPending || !formState.isDirty}>
                {save.isSuccess && !formState.isDirty ? <Check className="size-4" /> : <Save className="size-4" />}
                {save.isPending ? 'Saving…' : save.isSuccess && !formState.isDirty ? 'Saved' : 'Save settings'}
              </Button>
            </form>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader icon={KeyRound} title="Access" />
          <p className="mt-3 text-sm text-muted">
            APAY is run by the <b className="text-navy">HR department</b> only. Other accounts (Finance, Management, employees) can’t sign in.
          </p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {rolePermissions.hr.map((p) => (
              <li key={p} className="flex items-center justify-between py-2.5">
                <span className="text-ink">{permissionLabels[p]}</span>
                <Check className="size-4 text-success" aria-label="Allowed" />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <CardHeader icon={History} title="Audit trail" />
        <ul className="mt-4 divide-y divide-line">
          {audit.data?.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="text-ink">
                <b className="text-navy">{a.actor}</b> · {a.action} · <span className="text-muted">{a.target}</span>
              </span>
              <span className="text-xs text-muted">{formatDistanceToNowStrict(new Date(a.at), { addSuffix: true })}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function Toggle({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm font-medium text-navy transition hover:border-primary-200">
      {label}
      <input type="checkbox" className="size-4 accent-primary" {...props} />
    </label>
  )
}
