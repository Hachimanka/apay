import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Anchor, ArrowRightLeft, BadgeAlert, GraduationCap, LogOut, Pencil, Plus, Ship } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { useCadets, useCrew, useEmployees, useLicenses, useShippingMutations, useVessels } from '@/services/queries'
import type { Cadet, CadetInput, CadetStage, CrewStint, DisembarkReason, License, Vessel, VesselInput, VesselType } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { formatDate } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'

export const vesselTypeLabels: Record<VesselType, string> = {
  roro: 'RoRo',
  passenger: 'Passenger',
  cargo: 'General cargo',
  container: 'Container',
  tanker: 'Tanker',
  bulk: 'Bulk carrier',
  tug: 'Tug',
  other: 'Other',
}
export const disembarkLabels: Record<DisembarkReason, string> = {
  end_of_contract: 'End of contract',
  transfer: 'Transfer to another vessel',
  vacation: 'Vacation',
  medical: 'Medical',
  emergency: 'Emergency',
  termination: 'Termination',
  other: 'Other',
}
export const cadetStageLabels: Record<CadetStage, string> = {
  applicant: 'Applicant',
  screening: 'Screening',
  accepted: 'Accepted',
  onboard: 'Onboard training',
  completed: 'Completed',
  hired: 'Hired',
  dropped: 'Dropped',
}
const cadetNext: Record<CadetStage, CadetStage[]> = {
  applicant: ['screening', 'dropped'],
  screening: ['accepted', 'dropped'],
  accepted: ['onboard', 'dropped'],
  onboard: ['completed', 'dropped'],
  completed: ['hired', 'dropped'],
  hired: [],
  dropped: ['applicant'],
}
const stageTone: Record<CadetStage, BadgeTone> = {
  applicant: 'neutral',
  screening: 'warning',
  accepted: 'primary',
  onboard: 'primary',
  completed: 'success',
  hired: 'success',
  dropped: 'danger',
}

const tabs = [
  { id: 'vessels', label: 'Vessels', icon: Ship },
  { id: 'crew', label: 'Embarkation & movement', icon: Anchor },
  { id: 'cadets', label: 'Cadetship', icon: GraduationCap },
  { id: 'licenses', label: 'License expiry', icon: BadgeAlert },
] as const
type Tab = (typeof tabs)[number]['id']

/** Phase 5 (checklist #28, #44, #45, #87): the fleet, who's aboard, crew movement, cadets and license expiry. */
export function FleetPage() {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'vessels') as Tab
  const canManage = can(useAuth((s) => s.session?.user.role), 'employees.manage')
  return (
    <>
      <PageHeader eyebrow="People & Time" title="Fleet & Crew" description="Vessels, embarkation and disembarkation, crew movement across vessels, cadets and license expiry." />
      <div role="tablist" className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'vessels' ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
              tab === t.id ? 'bg-primary text-white shadow-card' : 'text-muted hover:bg-primary-50 hover:text-primary',
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'vessels' && <Vessels canManage={canManage} />}
      {tab === 'crew' && <CrewMovements canManage={canManage} />}
      {tab === 'cadets' && <Cadets canManage={canManage} />}
      {tab === 'licenses' && <Licenses />}
    </>
  )
}

/* ---------------------------------- Vessels ---------------------------------- */

function Vessels({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useVessels()
  const [editing, setEditing] = useState<Vessel | 'new' | null>(null)
  const columns: ColumnDef<Vessel>[] = [
    {
      accessorKey: 'name',
      header: 'Vessel',
      cell: ({ row }) => (
        <span>
          <span className="block font-semibold text-navy">{row.original.name}</span>
          <span className="block text-xs text-muted">
            {vesselTypeLabels[row.original.type]}
            {row.original.imoNo && ` · IMO ${row.original.imoNo}`}
          </span>
        </span>
      ),
    },
    { accessorKey: 'homePort', header: 'Home port' },
    { accessorKey: 'grossTonnage', header: 'GT', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number | null>() ?? '—' },
    {
      id: 'manning',
      header: 'Aboard / required',
      meta: { align: 'right' },
      accessorFn: (v) => v.aboard,
      cell: ({ row }) => {
        const v = row.original
        const short = v.complement != null && v.aboard < v.complement
        return (
          <span className={cn('font-semibold', short ? 'text-warning' : 'text-navy')}>
            {v.aboard} / {v.complement ?? '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge size="sm" tone={getValue<string>() === 'active' ? 'success' : getValue<string>() === 'sold' ? 'neutral' : 'warning'}>
          {getValue<string>().replace('_', ' ')}
        </Badge>
      ),
    },
    {
      id: 'edit',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        canManage ? (
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-primary-50 hover:text-primary" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}>
            <Pencil className="size-4" />
          </button>
        ) : null,
    },
  ]
  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search vessel…"
        toolbar={
          canManage ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add vessel
            </Button>
          ) : undefined
        }
        empty={<div className="py-12 text-center text-sm text-muted">No vessels yet — add the fleet to start recording embarkations.</div>}
      />
      {editing && <VesselDialog vessel={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function VesselDialog({ vessel, onClose }: { vessel: Vessel | null; onClose: () => void }) {
  const { saveVessel } = useShippingMutations()
  const [v, setV] = useState<VesselInput>(
    vessel ?? { name: '', imoNo: '', type: 'roro', flag: 'Philippines', grossTonnage: null, homePort: '', complement: null, status: 'active', notes: '' },
  )
  const set = <K extends keyof VesselInput>(k: K, val: VesselInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const num = (s: string) => (s === '' ? null : Number(s))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={vessel ? `Edit ${vessel.name}` : 'Add vessel'}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          saveVessel.mutate(v, { onSuccess: onClose })
        }}
      >
        <div className="col-span-2">
          <Field label="Name">
            <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. MV Aznar Star" autoFocus />
          </Field>
        </div>
        <Field label="Type">
          <Select value={v.type} onChange={(e) => set('type', e.target.value as VesselType)}>
            {(Object.keys(vesselTypeLabels) as VesselType[]).map((t) => (
              <option key={t} value={t}>
                {vesselTypeLabels[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="IMO number">
          <Input inputMode="numeric" maxLength={7} value={v.imoNo} onChange={(e) => set('imoNo', e.target.value.replace(/\D/g, ''))} placeholder="7 digits" />
        </Field>
        <Field label="Flag">
          <Input value={v.flag} onChange={(e) => set('flag', e.target.value)} />
        </Field>
        <Field label="Home port">
          <Input value={v.homePort} onChange={(e) => set('homePort', e.target.value)} />
        </Field>
        <Field label="Gross tonnage">
          <Input type="number" min={0} value={v.grossTonnage ?? ''} onChange={(e) => set('grossTonnage', num(e.target.value))} />
        </Field>
        <Field label="Required crew">
          <Input type="number" min={0} value={v.complement ?? ''} onChange={(e) => set('complement', num(e.target.value))} />
        </Field>
        <Field label="Status">
          <Select value={v.status} onChange={(e) => set('status', e.target.value as Vessel['status'])}>
            <option value="active">Active</option>
            <option value="drydock">Drydock</option>
            <option value="laid_up">Laid up</option>
            <option value="sold">Sold</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <Textarea className="min-h-16" value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        {saveVessel.error && <p className="col-span-2 text-sm text-danger">{saveVessel.error.message}</p>}
        <Button type="submit" className="col-span-2" disabled={saveVessel.isPending || v.name.trim().length < 2}>
          {saveVessel.isPending ? 'Saving…' : 'Save vessel'}
        </Button>
      </form>
    </Dialog>
  )
}

/* ------------------------------ Crew movements ------------------------------ */

export function CrewMovements({ canManage, employeeId }: { canManage: boolean; employeeId?: string }) {
  const [aboardOnly, setAboardOnly] = useState(!employeeId)
  const { data, isLoading } = useCrew({ employeeId, aboard: aboardOnly && !employeeId })
  const [embarking, setEmbarking] = useState(false)
  const [leaving, setLeaving] = useState<CrewStint | null>(null)
  const columns: ColumnDef<CrewStint>[] = [
    ...(!employeeId
      ? [
          {
            accessorKey: 'employeeName',
            header: 'Seafarer',
            cell: ({ row }) => (
              <Link to={`/app/employees/${row.original.employeeId}?tab=sea-service`} className="font-semibold text-navy hover:text-primary">
                {row.original.employeeName}
              </Link>
            ),
          } satisfies ColumnDef<CrewStint>,
        ]
      : []),
    { accessorKey: 'vesselName', header: 'Vessel', cell: ({ getValue }) => <span className="font-medium text-navy">{getValue<string>()}</span> },
    { accessorKey: 'rank', header: 'Rank' },
    {
      accessorKey: 'embarkDate',
      header: 'Embarked',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDate(row.original.embarkDate)}
          {row.original.embarkPort && <span className="block text-xs text-muted">{row.original.embarkPort}</span>}
        </span>
      ),
    },
    {
      id: 'disembark',
      header: 'Disembarked',
      accessorFn: (s) => s.disembarkDate ?? '9999',
      cell: ({ row }) =>
        row.original.aboard ? (
          <Badge size="sm" tone="success">
            Aboard
          </Badge>
        ) : (
          <span className="whitespace-nowrap">
            {formatDate(row.original.disembarkDate!)}
            <span className="block text-xs text-muted">
              {row.original.disembarkReason ? disembarkLabels[row.original.disembarkReason] : ''}
              {row.original.disembarkPort && ` · ${row.original.disembarkPort}`}
            </span>
          </span>
        ),
    },
    { accessorKey: 'days', header: 'Days', meta: { align: 'right' } },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        canManage && row.original.aboard ? (
          <Button size="sm" variant="outline" onClick={() => setLeaving(row.original)}>
            <LogOut className="size-4" /> Disembark
          </Button>
        ) : null,
    },
  ]
  const total = (data ?? []).reduce((s, x) => s + x.days, 0)
  return (
    <>
      {employeeId && (
        <p className="mb-3 text-sm text-muted">
          Total sea service: <span className="font-semibold text-navy">{total} days</span> ({(total / 30.4).toFixed(1)} months)
        </p>
      )}
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search seafarer, vessel or rank…"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {!employeeId && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-primary" checked={aboardOnly} onChange={(e) => setAboardOnly(e.target.checked)} />
                Aboard now only
              </label>
            )}
            {canManage && (
              <Button size="sm" onClick={() => setEmbarking(true)}>
                <Plus className="size-4" /> Record embarkation
              </Button>
            )}
          </div>
        }
        empty={<div className="py-12 text-center text-sm text-muted">No crew records.</div>}
      />
      {embarking && <EmbarkDialog employeeId={employeeId} onClose={() => setEmbarking(false)} />}
      {leaving && <DisembarkDialog stint={leaving} onClose={() => setLeaving(null)} />}
    </>
  )
}

function EmbarkDialog({ employeeId, onClose }: { employeeId?: string; onClose: () => void }) {
  const employees = useEmployees()
  const vessels = useVessels()
  const { saveStint } = useShippingMutations()
  const [f, setF] = useState({ employeeId: employeeId ?? '', vesselId: '', rank: '', embarkDate: manilaToday(), embarkPort: '', remarks: '' })
  const ok = f.employeeId && f.vesselId && f.rank.trim().length >= 2 && f.embarkDate
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Record embarkation" description="A seafarer joins a vessel">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) saveStint.mutate({ ...f, disembarkDate: null, disembarkPort: '', disembarkReason: null }, { onSuccess: onClose })
        }}
      >
        {!employeeId && (
          <div className="col-span-2">
            <Field label="Seafarer">
              <Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
                <option value="">Select…</option>
                {(employees.data ?? [])
                  .filter((e) => e.status !== 'resigned')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} · {e.position}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Vessel">
          <Select value={f.vesselId} onChange={(e) => setF({ ...f, vesselId: e.target.value })}>
            <option value="">Select…</option>
            {(vessels.data ?? [])
              .filter((v) => v.status !== 'sold')
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Rank aboard">
          <Input value={f.rank} onChange={(e) => setF({ ...f, rank: e.target.value })} placeholder="e.g. Able Seaman" />
        </Field>
        <Field label="Embarkation date">
          <Input type="date" value={f.embarkDate} onChange={(e) => setF({ ...f, embarkDate: e.target.value })} />
        </Field>
        <Field label="Port">
          <Input value={f.embarkPort} onChange={(e) => setF({ ...f, embarkPort: e.target.value })} placeholder="e.g. Cebu" />
        </Field>
        <div className="col-span-2">
          <Field label="Remarks">
            <Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
          </Field>
        </div>
        {saveStint.error && <p className="col-span-2 text-sm text-danger">{saveStint.error.message}</p>}
        <Button type="submit" className="col-span-2" disabled={!ok || saveStint.isPending}>
          {saveStint.isPending ? 'Saving…' : 'Record embarkation'}
        </Button>
      </form>
    </Dialog>
  )
}

function DisembarkDialog({ stint, onClose }: { stint: CrewStint; onClose: () => void }) {
  const vessels = useVessels()
  const { disembark } = useShippingMutations()
  const [f, setF] = useState({ date: manilaToday(), port: '', reason: 'end_of_contract' as DisembarkReason, remarks: stint.remarks, vesselId: '', rank: stint.rank })
  const transfer = f.reason === 'transfer'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Disembark" description={`${stint.employeeName ?? ''} · ${stint.vesselName ?? ''} · aboard since ${formatDate(stint.embarkDate)}`}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (transfer && !f.vesselId) return
          disembark.mutate(
            {
              id: stint.id,
              input: { date: f.date, port: f.port, reason: f.reason, remarks: f.remarks, transferTo: transfer ? { vesselId: f.vesselId, rank: f.rank } : undefined },
            },
            { onSuccess: onClose },
          )
        }}
      >
        <Field label="Date">
          <Input type="date" min={stint.embarkDate} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Port">
          <Input value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} />
        </Field>
        <div className="col-span-2">
          <Field label="Reason">
            <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value as DisembarkReason })}>
              {(Object.keys(disembarkLabels) as DisembarkReason[]).map((r) => (
                <option key={r} value={r}>
                  {disembarkLabels[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {transfer && (
          <>
            <Field label="Transfer to">
              <Select value={f.vesselId} onChange={(e) => setF({ ...f, vesselId: e.target.value })}>
                <option value="">Select vessel…</option>
                {(vessels.data ?? [])
                  .filter((v) => v.id !== stint.vesselId && v.status !== 'sold')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="New rank">
              <Input value={f.rank} onChange={(e) => setF({ ...f, rank: e.target.value })} />
            </Field>
          </>
        )}
        <div className="col-span-2">
          <Field label="Remarks">
            <Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
          </Field>
        </div>
        {disembark.error && <p className="col-span-2 text-sm text-danger">{disembark.error.message}</p>}
        <Button type="submit" className="col-span-2" disabled={disembark.isPending || (transfer && !f.vesselId)}>
          {transfer ? <ArrowRightLeft className="size-4" /> : <LogOut className="size-4" />}
          {disembark.isPending ? 'Saving…' : transfer ? 'Disembark & transfer' : 'Disembark'}
        </Button>
      </form>
    </Dialog>
  )
}

/* ---------------------------------- Cadets ---------------------------------- */

function Cadets({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useCadets()
  const [open, setOpen] = useState<Cadet | 'new' | null>(null)
  const counts = (Object.keys(cadetStageLabels) as CadetStage[]).map((s) => [s, (data ?? []).filter((c) => c.stage === s).length] as const)
  const columns: ColumnDef<Cadet>[] = [
    {
      id: 'name',
      header: 'Cadet',
      accessorFn: (c) => `${c.lastName}, ${c.firstName}`,
      cell: ({ row }) => (
        <span>
          <span className="block font-semibold text-navy">
            {row.original.lastName}, {row.original.firstName}
          </span>
          <span className="block text-xs text-muted">
            {row.original.school} · {row.original.course.toUpperCase()} {row.original.batch}
          </span>
        </span>
      ),
    },
    {
      accessorKey: 'stage',
      header: 'Stage',
      cell: ({ row }) => (
        <Badge size="sm" tone={stageTone[row.original.stage]}>
          {cadetStageLabels[row.original.stage]}
        </Badge>
      ),
    },
    { accessorKey: 'vesselName', header: 'Vessel', cell: ({ getValue }) => getValue<string>() ?? '—' },
    {
      id: 'sea',
      header: 'Sea service',
      accessorFn: (c) => c.seaProgress,
      cell: ({ row }) => (
        <span className="block min-w-32">
          <span className="text-xs text-muted">
            {row.original.seaDays} / {row.original.requiredSeaDays} days
          </span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-success" style={{ width: `${row.original.seaProgress}%` }} />
          </span>
        </span>
      ),
    },
  ]
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map(([s, n]) => (
          <span key={s} className="rounded-xl bg-surface px-3 py-2 text-sm shadow-card">
            <span className="text-muted">{cadetStageLabels[s]}</span> <span className="font-bold text-navy">{n}</span>
          </span>
        ))}
      </div>
      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search cadet or school…"
        onRowClick={setOpen}
        toolbar={
          canManage ? (
            <Button size="sm" onClick={() => setOpen('new')}>
              <Plus className="size-4" /> Add cadet
            </Button>
          ) : undefined
        }
        empty={<div className="py-12 text-center text-sm text-muted">No cadets yet.</div>}
      />
      {open && <CadetDialog cadet={open === 'new' ? null : open} canManage={canManage} onClose={() => setOpen(null)} />}
    </>
  )
}

function CadetDialog({ cadet, canManage, onClose }: { cadet: Cadet | null; canManage: boolean; onClose: () => void }) {
  const vessels = useVessels()
  const employees = useEmployees()
  const m = useShippingMutations()
  const [c, setC] = useState<CadetInput>(
    cadet ?? {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      phone: '',
      birthday: null,
      school: '',
      course: 'bsmt',
      batch: '',
      vesselId: null,
      embarkDate: null,
      disembarkDate: null,
      requiredSeaDays: 365,
      evaluation: '',
      employeeId: null,
      remarks: '',
    },
  )
  const [note, setNote] = useState('')
  const set = <K extends keyof CadetInput>(k: K, v: CadetInput[K]) => setC((x) => ({ ...x, [k]: v }))
  const error = m.saveCadet.error ?? m.moveCadet.error
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={cadet ? `${cadet.firstName} ${cadet.lastName}` : 'Add cadet'} description={cadet ? cadetStageLabels[cadet.stage] : 'Starts as an applicant'}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          m.saveCadet.mutate(c, { onSuccess: () => !cadet && onClose() })
        }}
      >
        <Field label="First name">
          <Input value={c.firstName} onChange={(e) => set('firstName', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Last name">
          <Input value={c.lastName} onChange={(e) => set('lastName', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="School">
          <Input value={c.school} onChange={(e) => set('school', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Course">
          <Select value={c.course} onChange={(e) => set('course', e.target.value as Cadet['course'])} disabled={!canManage}>
            <option value="bsmt">BS Marine Transportation (deck)</option>
            <option value="bsmare">BS Marine Engineering (engine)</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Batch">
          <Input value={c.batch} onChange={(e) => set('batch', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Required sea days">
          <Input type="number" min={1} value={c.requiredSeaDays} onChange={(e) => set('requiredSeaDays', Number(e.target.value))} disabled={!canManage} />
        </Field>
        <Field label="Training vessel">
          <Select value={c.vesselId ?? ''} onChange={(e) => set('vesselId', e.target.value || null)} disabled={!canManage}>
            <option value="">None yet</option>
            {(vessels.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Embarked">
          <Input type="date" value={c.embarkDate ?? ''} onChange={(e) => set('embarkDate', e.target.value || null)} disabled={!canManage} />
        </Field>
        <Field label="Email">
          <Input type="email" value={c.email} onChange={(e) => set('email', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Phone">
          <Input value={c.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canManage} />
        </Field>
        <div className="col-span-2">
          <Field label="Onboard evaluation / training record">
            <Textarea className="min-h-16" value={c.evaluation} onChange={(e) => set('evaluation', e.target.value)} disabled={!canManage} />
          </Field>
        </div>
        {cadet && (cadet.stage === 'completed' || cadet.stage === 'hired') && (
          <div className="col-span-2">
            <Field label="201 file (when hired)">
              <Select value={c.employeeId ?? ''} onChange={(e) => set('employeeId', e.target.value || null)} disabled={!canManage}>
                <option value="">Not linked</option>
                {(employees.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {canManage && (
          <Button type="submit" variant={cadet ? 'outline' : 'primary'} className="col-span-2" disabled={m.saveCadet.isPending || !c.firstName.trim() || !c.lastName.trim()}>
            {m.saveCadet.isPending ? 'Saving…' : cadet ? 'Save details' : 'Add cadet'}
          </Button>
        )}
      </form>

      {cadet && (
        <div className="mt-5 border-t border-line pt-4">
          {canManage && cadetNext[cadet.stage].length > 0 && (
            <div className="mb-4 space-y-2">
              <Input placeholder="Note for this step (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {cadetNext[cadet.stage].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'dropped' ? 'outline' : 'primary'}
                    disabled={m.moveCadet.isPending}
                    onClick={() => m.moveCadet.mutate({ id: cadet.id, stage: s, note }, { onSuccess: onClose })}
                  >
                    Move to {cadetStageLabels[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">History</p>
          <ol className="space-y-1 text-sm">
            {cadet.stageHistory.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-24 shrink-0 text-muted">{formatDate(h.date)}</span>
                <span className="text-ink">
                  <span className="font-medium text-navy">{cadetStageLabels[h.stage]}</span>
                  {h.note && ` — ${h.note}`}
                  <span className="text-muted"> · {h.by}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error.message}</p>}
    </Dialog>
  )
}

/* ------------------------------ License expiry ------------------------------ */

export function Licenses() {
  const [days, setDays] = useState(90)
  const { data, isLoading } = useLicenses(days)
  const rows = data ?? []
  const stats = [
    { label: 'Expired', value: rows.filter((r) => r.daysLeft < 0).length, tone: 'danger' as const },
    { label: 'Within 30 days', value: rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30).length, tone: 'warning' as const },
    { label: `31–${days} days`, value: rows.filter((r) => r.daysLeft > 30).length, tone: 'primary' as const },
  ]
  const columns: ColumnDef<License>[] = [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
      cell: ({ row }) => (
        <Link to={`/app/employees/${row.original.employeeId}?tab=development`} className="block">
          <span className="block font-semibold text-navy hover:text-primary">{row.original.employeeName}</span>
          <span className="block text-xs text-muted">{row.original.department}</span>
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: 'License / certificate',
      cell: ({ row }) => (
        <span>
          <span className="block text-ink">{row.original.name}</span>
          <span className="block text-xs text-muted">
            {[row.original.number, row.original.issuedBy].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    { accessorKey: 'expiryDate', header: 'Expires', cell: ({ getValue }) => formatDate(getValue<string>()) },
    {
      accessorKey: 'daysLeft',
      header: 'Days left',
      meta: { align: 'right' },
      cell: ({ getValue }) => {
        const d = getValue<number>()
        return <span className={cn('font-semibold', d < 0 ? 'text-danger' : d <= 30 ? 'text-warning' : 'text-navy')}>{d < 0 ? `${-d} overdue` : d}</span>
      },
    },
  ]
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3 sm:gap-5">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={BadgeAlert} tone={s.tone} />
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-bold text-navy">{isLoading ? '—' : s.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted">
        Employees are notified in AZONE 60 and 30 days before a license expires and when it expires. Renewals: update the certification on the
        employee’s Development tab.
      </p>
      <DataTable
        data={rows}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search employee or license…"
        toolbar={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto py-2" aria-label="Window">
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={180}>Next 6 months</option>
            <option value={365}>Next 12 months</option>
          </Select>
        }
        empty={<div className="py-12 text-center text-sm text-muted">No license expires in this window.</div>}
      />
    </>
  )
}
