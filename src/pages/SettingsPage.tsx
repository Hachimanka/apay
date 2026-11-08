import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, History, Save, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/Misc'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAudit, useSaveSettings, useSettings } from '@/services/queries'
import type { PayrollSettings } from '@/services/types'
import { can } from '@/lib/permissions'
import { AccessRights } from '@/features/settings/AccessRights'
import { BackupCard, DevicesCard, GeofenceCard, PrivacyCard } from '@/features/settings/PlatformSettings'
import { useAuth } from '@/store/auth'
import { HolidayCalendar } from '@/features/settings/HolidayCalendar'
import { ShiftCodes } from '@/features/settings/ShiftCodes'


export function SettingsPage() {
  const { data } = useSettings()
  const audit = useAudit()
  const save = useSaveSettings()
  const canManage = can(useAuth((s) => s.session?.user.role), 'settings.manage')
  const { register, handleSubmit, reset, formState } = useForm<PayrollSettings>()

  useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" description="Payroll rules, access rights, privacy, devices, backups and the audit trail." />

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
              <Toggle label="Email employees a link to their payslip on release (no amounts in the email)" {...register('emailPayslips')} />
              <Toggle label="Add the 13th month to the December 16–31 payroll automatically" {...register('thirteenthMonthAuto')} />
              <Button type="submit" disabled={save.isPending || !formState.isDirty}>
                {save.isSuccess && !formState.isDirty ? <Check className="size-4" /> : <Save className="size-4" />}
                {save.isPending ? 'Saving…' : save.isSuccess && !formState.isDirty ? 'Saved' : 'Save settings'}
              </Button>
            </form>
          )}
        </Card>

        <AccessRights />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <HolidayCalendar canManage={canManage} />
        <ShiftCodes canManage={canManage} defaultStart={data?.shiftStartMinutes ?? 480} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <PrivacyCard canManage={canManage} />
        <div className="grid content-start gap-5">
          <GeofenceCard canManage={canManage} />
          <BackupCard />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <DevicesCard canManage={canManage} />
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
