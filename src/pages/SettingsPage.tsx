import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, History, KeyRound, Save, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/Misc'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAudit, useSaveSettings, useSettings } from '@/services/queries'
import type { PayrollSettings, Role } from '@/services/types'
import { roleLabels, rolePermissions, type Permission } from '@/lib/permissions'

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
              <Toggle label="Require Finance approval before release" {...register('requireTwoStepApproval')} />
              <Toggle label="Publish released payslips to AZONE automatically" {...register('autoPublishToAzone')} />
              <Button type="submit" disabled={save.isPending || !formState.isDirty}>
                {save.isSuccess && !formState.isDirty ? <Check className="size-4" /> : <Save className="size-4" />}
                {save.isPending ? 'Saving…' : save.isSuccess && !formState.isDirty ? 'Saved' : 'Save settings'}
              </Button>
            </form>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader icon={KeyRound} title="Roles & permissions" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 text-left font-semibold">Permission</th>
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <th key={r} className="px-2 py-2 text-center font-semibold">
                      {roleLabels[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(Object.keys(permissionLabels) as Permission[]).map((p) => (
                  <tr key={p}>
                    <td className="py-2.5 text-ink">{permissionLabels[p]}</td>
                    {(Object.keys(roleLabels) as Role[]).map((r) => (
                      <td key={r} className="px-2 py-2.5 text-center">
                        {rolePermissions[r].includes(p) ? (
                          <Check className="mx-auto size-4 text-success" aria-label="Allowed" />
                        ) : (
                          <span className="text-line">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
