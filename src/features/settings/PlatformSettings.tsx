import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, Copy, DatabaseBackup, Fingerprint, MapPin, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import {
  downloadJson,
  platformApi,
  useBackupStatus,
  useDeviceMutations,
  useDevices,
  useGeofence,
  usePrivacy,
  usePrivacyMutations,
  useSaveGeofence,
  type Device,
  type Geofence,
  type PrivacySettings,
} from '@/services/platform'
import { useAuth } from '@/store/auth'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : 'never')

/* -------------------------------- Data privacy (#86) -------------------------------- */

export function PrivacyCard({ canManage }: { canManage: boolean }) {
  const { data } = usePrivacy()
  const { save } = usePrivacyMutations()
  const [s, setS] = useState<PrivacySettings | null>(null)
  useEffect(() => {
    if (data) setS(data.settings)
  }, [data])
  const dirty = !!s && !!data && JSON.stringify(s) !== JSON.stringify(data.settings)
  const versionChanged = !!s && !!data && s.noticeVersion !== data.settings.noticeVersion

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={ShieldCheck} title="Data privacy" />
      {!data || !s ? (
        <Skeleton className="mt-4 h-48" />
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Stat label="Acknowledged current notice" value={`${data.consent.consented} / ${data.consent.total}`} />
            <Stat label="On an older version" value={data.consent.older} />
            <Stat label="Due for erasure" value={data.dueForErasure.length} tone={data.dueForErasure.length ? 'warning' : undefined} />
          </div>
          <p className="text-xs text-muted">
            Employees acknowledge the privacy notice in AZONE (RA 10173). Separated employees’ personal data can be erased from their profile after the
            retention period; payslips stay for audits without their name.
          </p>
          {data.dueForErasure.length > 0 && (
            <ul className="rounded-xl border border-warning/30 bg-warning-50 px-4 py-2 text-sm">
              {data.dueForErasure.slice(0, 5).map((d) => (
                <li key={d.employeeId} className="py-1">
                  <Link className="font-medium text-navy hover:text-primary" to={`/app/employees/${d.employeeId}`}>
                    {d.name}
                  </Link>{' '}
                  <span className="text-xs text-muted">
                    · separated {d.separationDate}, erasable since {d.erasableFrom}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Notice version">
              <Input value={s.noticeVersion} disabled={!canManage} onChange={(e) => setS({ ...s, noticeVersion: e.target.value })} />
            </Field>
            <Field label="Keep records after separation (years)">
              <Input type="number" min={3} max={30} value={s.retentionYears} disabled={!canManage} onChange={(e) => setS({ ...s, retentionYears: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Privacy notice shown in AZONE">
            <Textarea rows={6} value={s.notice} disabled={!canManage} onChange={(e) => setS({ ...s, notice: e.target.value })} />
          </Field>
          {versionChanged && <p className="text-xs text-warning">A new version asks every employee to acknowledge the notice again.</p>}
          {save.isError && <p className="text-sm text-danger">{errorText(save.error)}</p>}
          {canManage && (
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(s)}>
              <Save className="size-4" /> {save.isPending ? 'Saving…' : 'Save privacy settings'}
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warning' }) {
  return (
    <div className={cn('rounded-xl border border-line px-2 py-3', tone === 'warning' && 'border-warning/40 bg-warning-50')}>
      <b className="block text-lg text-navy">{value}</b>
      <span className="text-[11px] leading-tight text-muted">{label}</span>
    </div>
  )
}

/* ----------------------------- Biometric devices (#84) ----------------------------- */

export function DevicesCard({ canManage }: { canManage: boolean }) {
  const { data } = useDevices()
  const m = useDeviceMutations()
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<{ name: string; key: string } | null>(null)
  const endpoint = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '') || window.location.origin}/integrations/biometrics/punches`

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={Fingerprint}
        title="Biometric devices"
        action={
          canManage && (
            <Button size="sm" variant="soft" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Register
            </Button>
          )
        }
      />
      <p className="mt-2 text-xs text-muted">
        Devices (or the vendor’s sync software) push punches to <code className="rounded bg-line px-1">{endpoint}</code> with their key. Days HR typed or
        uploaded are never overwritten, and locked payrolls are skipped.
      </p>
      {!data ? (
        <Skeleton className="mt-4 h-24" />
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted italic">No devices yet — punches still come from AZONE and file uploads.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {data.map((d) => (
            <li key={d.id} className={cn('flex flex-wrap items-center gap-3 py-2.5', !d.active && 'opacity-60')}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium text-navy">
                  {d.name}
                  <Badge size="sm" tone="neutral">
                    {d.keyPrefix}…
                  </Badge>
                  {!d.active && <span className="text-xs font-normal text-muted">(disabled)</span>}
                </span>
                <span className="block text-xs text-muted">
                  {d.location && `${d.location} · `}last push {ago(d.lastSeenAt)}
                  {d.lastBatch && ` · ${d.lastBatch.saved} saved, ${d.lastBatch.skipped} skipped`}
                </span>
                {d.lastBatch?.errors.length ? <span className="block text-xs text-warning">{d.lastBatch.errors[0]}</span> : null}
              </span>
              {canManage && (
                <span className="flex shrink-0 items-center">
                  <Button size="sm" variant="ghost" onClick={() => m.update.mutate({ id: d.id, name: d.name, location: d.location, active: !d.active })}>
                    {d.active ? 'Disable' : 'Enable'}
                  </Button>
                  <button
                    aria-label={`New key for ${d.name}`}
                    title="Replace key"
                    className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-primary"
                    onClick={async () => {
                      if (!confirm(`Replace the key of ${d.name}? The old key stops working right away.`)) return
                      const r = await m.rotate.mutateAsync(d.id)
                      setShown({ name: d.name, key: r.key })
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Remove ${d.name}`}
                    className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-danger"
                    onClick={() => confirm(`Remove ${d.name}? Its punches already saved stay.`) && m.remove.mutate(d.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <AddDevice
          onClose={() => setAdding(false)}
          onAdded={(d, key) => {
            setAdding(false)
            setShown({ name: d.name, key })
          }}
        />
      )}
      {shown && <KeyDialog name={shown.name} deviceKey={shown.key} endpoint={endpoint} onClose={() => setShown(null)} />}
    </Card>
  )
}

function AddDevice({ onClose, onAdded }: { onClose: () => void; onAdded: (d: Device, key: string) => void }) {
  const { add } = useDeviceMutations()
  const [v, setV] = useState({ name: '', location: '' })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Register biometric device">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await add.mutateAsync(v)
          onAdded(r.device, r.key)
        }}
      >
        <Field label="Name">
          <Input required minLength={2} placeholder="e.g. Main office reader" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input placeholder="e.g. Pier 1, Cebu" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
        </Field>
        {add.isError && <p className="text-sm text-danger">{errorText(add.error)}</p>}
        <Button type="submit" className="w-full" disabled={add.isPending}>
          Register
        </Button>
      </form>
    </Dialog>
  )
}

function KeyDialog({ name, deviceKey, endpoint, onClose }: { name: string; deviceKey: string; endpoint: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Key for ${name}`} description="Copy it into the device or sync software now — it won’t be shown again.">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3 font-mono text-sm break-all text-navy">
        <span className="flex-1">{deviceKey}</span>
        <button aria-label="Copy key" className="rounded-lg p-1.5 text-muted hover:text-primary" onClick={() => navigator.clipboard.writeText(deviceKey).then(() => setCopied(true))}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-navy p-4 text-[11px] leading-relaxed text-white">{`POST ${endpoint}
Authorization: Bearer ${deviceKey.slice(0, 8)}…
Content-Type: application/json

{ "punches": [
  { "employeeNo": "AZ-0001", "at": "2026-11-09T08:02:00+08:00" }
] }`}</pre>
      <Button className="mt-5 w-full" onClick={onClose}>
        Done
      </Button>
    </Dialog>
  )
}

/* ------------------------------ Punch location (#88) ------------------------------ */

const modeLabels: Record<Geofence['mode'], string> = {
  off: 'Off — don’t collect location',
  record: 'Record — save location when the phone allows',
  enforce: 'Require — location on, inside an allowed site',
}

export function GeofenceCard({ canManage }: { canManage: boolean }) {
  const { data } = useGeofence()
  const save = useSaveGeofence()
  const [g, setG] = useState<Geofence | null>(null)
  useEffect(() => {
    if (data) setG(data)
  }, [data])
  const dirty = !!g && !!data && JSON.stringify(g) !== JSON.stringify(data)
  const invalid = g?.sites.some((s) => s.name.trim().length < 2 || Number.isNaN(s.lat) || Number.isNaN(s.lng) || s.radius < 25)

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={MapPin} title="AZONE punch location" />
      <p className="mt-2 text-xs text-muted">
        Geo-tags each AZONE time in / out. The DTR shows where each punch was made and flags punches outside the allowed sites. Crew aboard vessels usually
        punch through biometrics or HR, so “Require” only suits office and pier staff.
      </p>
      {!g ? (
        <Skeleton className="mt-4 h-32" />
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="Rule">
            <Select value={g.mode} disabled={!canManage} onChange={(e) => setG({ ...g, mode: e.target.value as Geofence['mode'] })}>
              {(Object.keys(modeLabels) as Geofence['mode'][]).map((m) => (
                <option key={m} value={m}>
                  {modeLabels[m]}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-navy">Allowed sites</span>
            {g.sites.length === 0 && <p className="text-sm text-muted italic">None — any location is accepted.</p>}
            <ul className="space-y-2">
              {g.sites.map((s, i) => {
                const set = (patch: Partial<typeof s>) => setG({ ...g, sites: g.sites.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
                return (
                  <li key={i} className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] items-center gap-2">
                    <Input aria-label="Site name" placeholder="Name" value={s.name} disabled={!canManage} onChange={(e) => set({ name: e.target.value })} />
                    <Input aria-label="Latitude" type="number" step="any" value={s.lat} disabled={!canManage} onChange={(e) => set({ lat: Number(e.target.value) })} />
                    <Input aria-label="Longitude" type="number" step="any" value={s.lng} disabled={!canManage} onChange={(e) => set({ lng: Number(e.target.value) })} />
                    <Input aria-label="Radius in metres" type="number" min={25} value={s.radius} disabled={!canManage} onChange={(e) => set({ radius: Number(e.target.value) })} />
                    {canManage && (
                      <button aria-label={`Remove ${s.name}`} className="rounded-lg p-1.5 text-muted hover:text-danger" onClick={() => setG({ ...g, sites: g.sites.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            {g.sites.length > 0 && <p className="mt-1 text-[11px] text-muted">Name · latitude · longitude · radius (m)</p>}
          </div>
          {save.isError && <p className="text-sm text-danger">{errorText(save.error)}</p>}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="soft"
                onClick={() =>
                  navigator.geolocation.getCurrentPosition(
                    (p) => setG({ ...g, sites: [...g.sites, { name: '', lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), radius: 150 }] }),
                    () => setG({ ...g, sites: [...g.sites, { name: '', lat: 10.2935, lng: 123.9022, radius: 150 }] }),
                  )
                }
              >
                <Plus className="size-4" /> Add site here
              </Button>
              <Button size="sm" disabled={!dirty || !!invalid || save.isPending} onClick={() => save.mutate(g)}>
                <Save className="size-4" /> Save
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------- Backup (#83) ---------------------------------- */

export function BackupCard() {
  const { data } = useBackupStatus()
  const isHr = useAuth((s) => s.session?.user.role) === 'hr'
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={DatabaseBackup} title="Backup & continuity" />
      <ul className="mt-3 space-y-1.5 text-sm text-ink">
        <li>• Supabase keeps daily database backups (point-in-time recovery on paid plans).</li>
        <li>• Download an offline copy of every table monthly and after each payroll release; store it encrypted, off-site.</li>
        <li>• Passwords and device keys are never included. The restore runbook is in aznar-api/docs/BACKUP.md.</li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        Last offline copy: {data?.lastExportAt ? `${ago(data.lastExportAt)}${data.by ? ` by ${data.by}` : ''}` : 'never'}
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {isHr && (
        <Button
          className="mt-4"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              const snap = await platformApi.backup()
              downloadJson(snap, `aznar-backup-${snap.createdAt.slice(0, 10)}.json`)
              qc.invalidateQueries({ queryKey: ['backup-status'] })
            } catch (e) {
              setError(errorText(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <DatabaseBackup className="size-4" /> {busy ? 'Preparing…' : 'Download full backup'}
        </Button>
      )}
    </Card>
  )
}
