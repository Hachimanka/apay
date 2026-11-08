import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, Copy, KeyRound, Plus, Save, UserCog } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { allPermissions, permissionLabels, roleLabels, type Permission } from '@/lib/permissions'
import { useAccess, useAccessMutations, type OtherRole, type RoleMatrix } from '@/services/platform'
import type { Role } from '@/services/types'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'

const otherRoles: OtherRole[] = ['payroll_admin', 'finance', 'management']
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Settings → Access rights (checklist #85): which roles may do what, and who has a staff account. Only HR edits it. */
export function AccessRights() {
  const { data } = useAccess()
  const { saveRoles } = useAccessMutations()
  const isHr = useAuth((s) => s.session?.user.role) === 'hr'
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null)
  useEffect(() => {
    if (data) setMatrix(data.matrix)
  }, [data])
  const dirty = !!data && !!matrix && JSON.stringify(data.matrix) !== JSON.stringify(matrix)
  const toggle = (r: OtherRole, p: Permission) =>
    matrix && setMatrix({ ...matrix, [r]: matrix[r].includes(p) ? matrix[r].filter((x) => x !== p) : [...matrix[r], p] })

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={KeyRound}
        title="Access rights"
        action={
          isHr && (
            <Button size="sm" disabled={!dirty || saveRoles.isPending} onClick={() => matrix && saveRoles.mutate(matrix)}>
              {saveRoles.isSuccess && !dirty ? <Check className="size-4" /> : <Save className="size-4" />}
              {saveRoles.isPending ? 'Saving…' : 'Save'}
            </Button>
          )
        }
      />
      <p className="mt-2 text-xs text-muted">
        HR always has every right. A role with no rights can’t sign in to APAY. Changes apply on the next click — no need to sign out.
      </p>
      {!matrix ? (
        <Skeleton className="mt-4 h-64" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold tracking-wide text-muted uppercase">
                <th className="py-2 pr-3">Right</th>
                <th className="px-2 py-2 text-center">HR</th>
                {otherRoles.map((r) => (
                  <th key={r} className="px-2 py-2 text-center">
                    {roleLabels[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {allPermissions.map((p) => (
                <tr key={p}>
                  <td className="py-2 pr-3 text-ink">{permissionLabels[p]}</td>
                  <td className="px-2 py-2 text-center">
                    <Check className="mx-auto size-4 text-success" aria-label="Allowed" />
                  </td>
                  {otherRoles.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={`${roleLabels[r]}: ${permissionLabels[p]}`}
                        checked={matrix[r].includes(p)}
                        disabled={!isHr}
                        onChange={() => toggle(r, p)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {saveRoles.isError && <p className="mt-2 text-sm text-danger">{errorText(saveRoles.error)}</p>}
        </div>
      )}
      <StaffAccounts />
    </Card>
  )
}

function StaffAccounts() {
  const { data } = useAccess()
  const { updateAccount } = useAccessMutations()
  const me = useAuth((s) => s.session?.user.id)
  const isHr = useAuth((s) => s.session?.user.role) === 'hr'
  const [adding, setAdding] = useState(false)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy">
          <UserCog className="size-4" /> Staff accounts
        </h3>
        {isHr && (
          <Button size="sm" variant="soft" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line text-sm">
        {data?.accounts.map((a) => (
          <li key={a.id} className={cn('flex flex-wrap items-center gap-3 py-2.5', !a.active && 'opacity-60')}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-navy">
                {a.name} {a.id === me && <span className="text-xs font-normal text-muted">(you)</span>}
              </span>
              <span className="block text-xs text-muted">
                {a.email}
                {a.lastLoginAt ? ` · last sign-in ${formatDistanceToNowStrict(new Date(a.lastLoginAt), { addSuffix: true })}` : ' · never signed in'}
              </span>
            </span>
            {isHr && a.id !== me ? (
              <>
                <Select
                  aria-label={`Role of ${a.name}`}
                  className="h-9 w-40"
                  value={a.role}
                  onChange={(e) => updateAccount.mutate({ id: a.id, role: e.target.value as Role | 'employee' })}
                >
                  {(['hr', ...otherRoles] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                  {a.employeeId && <option value="employee">AZONE only (remove)</option>}
                </Select>
                <Button size="sm" variant="ghost" onClick={() => updateAccount.mutate({ id: a.id, active: !a.active })}>
                  {a.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </>
            ) : (
              <Badge size="sm" tone={a.role === 'hr' ? 'primary' : 'neutral'}>
                {roleLabels[a.role]}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      {updateAccount.isError && <p className="mt-2 text-sm text-danger">{errorText(updateAccount.error)}</p>}
      {adding && <AddAccount onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddAccount({ onClose }: { onClose: () => void }) {
  const { addAccount } = useAccessMutations()
  const [v, setV] = useState({ name: '', email: '', title: '', role: 'finance' as Role })
  const [result, setResult] = useState<{ email: string; temporaryPassword: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  if (result)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} title="Account ready">
        {result.temporaryPassword ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">Give this temporary password to the person. It’s shown only once.</p>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3 font-mono text-base text-navy">
              <span className="flex-1">{result.temporaryPassword}</span>
              <button
                aria-label="Copy password"
                className="rounded-lg p-1.5 text-muted hover:text-primary"
                onClick={() => navigator.clipboard.writeText(result.temporaryPassword!).then(() => setCopied(true))}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted">They sign in to APAY with {result.email}.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {result.email} already had an AZONE account, so they keep their own password and can now also sign in to APAY.
          </p>
        )}
        <Button className="mt-5 w-full" onClick={onClose}>
          Done
        </Button>
      </Dialog>
    )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add staff account" description="An employee’s work email gives their existing AZONE account APAY access too.">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await addAccount.mutateAsync(v)
          setResult({ email: r.account.email, temporaryPassword: r.temporaryPassword })
        }}
      >
        <Field label="Name">
          <Input required minLength={2} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input required type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field label="Job title">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            {(['hr', ...otherRoles] as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </Select>
        </Field>
        {addAccount.isError && <p className="col-span-2 text-sm text-danger">{errorText(addAccount.error)}</p>}
        <Button type="submit" className="col-span-2" disabled={addAccount.isPending}>
          {addAccount.isPending ? 'Adding…' : 'Add account'}
        </Button>
      </form>
    </Dialog>
  )
}
