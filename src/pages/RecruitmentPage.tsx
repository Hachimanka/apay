import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, FileCheck2, Pencil, Plus, Star, Trash2, UserPlus, UserSearch } from 'lucide-react'
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/Misc'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { departments } from '@/features/employees/employeeForm'
import { can } from '@/lib/permissions'
import { formatDate } from '@/lib/format'
import { manilaToday } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'
import { useAuth } from '@/store/auth'
import {
  applicantStages,
  preEmploymentDocs,
  useApplicantMutations,
  useApplicants,
  type Applicant,
  type ApplicantInput,
  type ApplicantStage,
  type PreEmploymentDoc,
} from '@/services/platform'

export const applicantStageLabels: Record<ApplicantStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Job offer',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrew',
}
const stageTone: Record<ApplicantStage, BadgeTone> = {
  applied: 'neutral',
  screening: 'warning',
  interview: 'violet',
  offer: 'primary',
  hired: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
}
/** Mirrors aznar-api routes/platform.ts */
const nextStages: Record<ApplicantStage, ApplicantStage[]> = {
  applied: ['screening', 'interview', 'rejected', 'withdrawn'],
  screening: ['interview', 'rejected', 'withdrawn', 'applied'],
  interview: ['offer', 'rejected', 'withdrawn', 'screening'],
  offer: ['rejected', 'withdrawn', 'interview'],
  hired: [],
  rejected: ['applied'],
  withdrawn: ['applied'],
}
const open: ApplicantStage[] = ['applied', 'screening', 'interview', 'offer']
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** The editable fields of an applicant (what PUT /applicants/:id takes) */
const toInput = (a: ApplicantInput): ApplicantInput => ({
  id: a.id,
  firstName: a.firstName,
  middleName: a.middleName,
  lastName: a.lastName,
  email: a.email,
  phone: a.phone,
  position: a.position,
  department: a.department,
  source: a.source,
  expectedSalary: a.expectedSalary,
  appliedDate: a.appliedDate,
  interviewAt: a.interviewAt,
  rating: a.rating,
  documents: a.documents,
  notes: a.notes,
})

const blank = (): ApplicantInput => ({
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  source: '',
  expectedSalary: '',
  appliedDate: manilaToday(),
  interviewAt: null,
  rating: null,
  documents: {},
  notes: '',
})

/** Applicant tracking and pre-employment requirements (checklist #50, #51). */
export function RecruitmentPage() {
  const { data } = useApplicants()
  const canManage = can(useAuth((s) => s.session?.user.role), 'employees.manage')
  const [filter, setFilter] = useState<'open' | ApplicantStage | 'all'>('open')
  const [editing, setEditing] = useState<ApplicantInput | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const counts = useMemo(() => Object.fromEntries(applicantStages.map((s) => [s, data?.filter((a) => a.stage === s).length ?? 0])) as Record<ApplicantStage, number>, [data])
  const list = (data ?? []).filter((a) => (filter === 'all' ? true : filter === 'open' ? open.includes(a.stage) : a.stage === filter))
  const current = data?.find((a) => a.id === viewing)

  return (
    <>
      <PageHeader
        eyebrow="People & Time"
        title="Recruitment"
        description="Applicants from application to job offer, with their pre-employment requirements. Hiring adds them as an employee with an AZONE account."
        actions={
          canManage && (
            <Button onClick={() => setEditing(blank())}>
              <Plus className="size-4" /> Add applicant
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {open.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn('rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary-200', filter === s && 'border-primary ring-2 ring-primary-100')}
          >
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{applicantStageLabels[s]}</span>
            <b className="block text-2xl text-navy">{counts[s]}</b>
          </button>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
          {(['open', 'hired', 'rejected', 'withdrawn', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-primary', filter === f && 'bg-primary-50 text-primary')}
            >
              {f === 'open' ? 'In progress' : f === 'all' ? 'All' : applicantStageLabels[f]}
            </button>
          ))}
        </div>
        {!data ? (
          <Skeleton className="m-4 h-40" />
        ) : list.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={UserSearch} title="No applicants here" description={canManage ? 'Add one with “Add applicant”.' : undefined} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a.id}>
                <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-primary-50/50" onClick={() => setViewing(a.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-navy">{a.fullName}</span>
                    <span className="block text-xs text-muted">
                      {a.position}
                      {a.department && ` · ${a.department}`} · applied {formatDate(a.appliedDate)}
                      {a.source && ` · ${a.source}`}
                    </span>
                  </span>
                  {a.rating && <Stars value={a.rating} />}
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <FileCheck2 className="size-3.5" /> {a.documentsReceived}/{a.documentsTotal}
                  </span>
                  <Badge size="sm" tone={stageTone[a.stage]}>
                    {applicantStageLabels[a.stage]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {current && <ApplicantDialog applicant={current} canManage={canManage} onClose={() => setViewing(null)} onEdit={() => setEditing(current)} />}
      {editing && <ApplicantForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', i <= value ? 'fill-warning text-warning' : 'text-line')} />
      ))}
    </span>
  )
}

function ApplicantDialog({ applicant: a, canManage, onClose, onEdit }: { applicant: Applicant; canManage: boolean; onClose: () => void; onEdit: () => void }) {
  const m = useApplicantMutations()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const toggleDoc = (d: PreEmploymentDoc) => {
    const got = a.documents[d]?.received
    m.save.mutate({ ...toInput(a), documents: { ...a.documents, [d]: got ? { received: false } : { received: true, date: manilaToday() } } })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={a.fullName} description={`${a.position}${a.department ? ` · ${a.department}` : ''}`}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={stageTone[a.stage]}>{applicantStageLabels[a.stage]}</Badge>
          {a.email && <span className="text-muted">{a.email}</span>}
          {a.phone && <span className="text-muted">· {a.phone}</span>}
          {a.expectedSalary && <span className="text-muted">· expects ₱{Number(a.expectedSalary).toLocaleString('en-PH')}</span>}
        </div>
        {a.interviewAt && <p className="text-muted">Interview: {new Date(a.interviewAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        {a.notes && <p className="rounded-xl bg-bg px-3 py-2 whitespace-pre-line text-ink">{a.notes}</p>}

        <section>
          <h3 className="mb-2 font-bold text-navy">
            Pre-employment requirements ({a.documentsReceived}/{a.documentsTotal})
          </h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {(Object.keys(preEmploymentDocs) as PreEmploymentDoc[]).map((d) => {
              const got = a.documents[d]?.received
              return (
                <li key={d}>
                  <button
                    disabled={!canManage || m.save.isPending}
                    onClick={() => toggleDoc(d)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-primary-50', got ? 'text-navy' : 'text-muted')}
                  >
                    {got ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0" />}
                    <span className="flex-1">{preEmploymentDocs[d]}</span>
                    {got && a.documents[d]?.date && <span className="text-[11px] text-muted">{formatDate(a.documents[d]!.date!)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 font-bold text-navy">History</h3>
          <ol className="space-y-1 text-xs text-muted">
            {a.stageHistory.map((h, i) => (
              <li key={i}>
                <b className="text-ink">{applicantStageLabels[h.stage]}</b> · {formatDate(h.date)} · {h.by}
                {h.note && ` — ${h.note}`}
              </li>
            ))}
          </ol>
        </section>

        {a.employeeId && (
          <Link to={`/app/employees/${a.employeeId}`} className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <UserPlus className="size-4" /> Open their employee profile
          </Link>
        )}

        {canManage && a.stage !== 'hired' && (
          <section className="space-y-2 border-t border-line pt-4">
            <Input placeholder="Note for the next step (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {a.stage === 'offer' && (
                <Button size="sm" onClick={() => navigate(`/app/employees/new?applicant=${a.id}`)}>
                  <UserPlus className="size-4" /> Hire
                </Button>
              )}
              {nextStages[a.stage].map((s) => (
                <Button key={s} size="sm" variant={s === 'rejected' || s === 'withdrawn' ? 'ghost' : 'soft'} disabled={m.move.isPending} onClick={() => m.move.mutate({ id: a.id, stage: s, note }, { onSuccess: () => setNote('') })}>
                  {applicantStageLabels[s]}
                </Button>
              ))}
            </div>
            {(m.move.isError || m.save.isError) && <p className="text-danger">{errorText(m.move.error ?? m.save.error)}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => confirm(`Delete ${a.fullName}'s application?`) && m.remove.mutate(a.id, { onSuccess: onClose })}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  )
}

function ApplicantForm({ initial, onClose }: { initial: ApplicantInput; onClose: () => void }) {
  const { save } = useApplicantMutations()
  const [v, setV] = useState<ApplicantInput>(() => toInput(initial))
  const set = (patch: Partial<ApplicantInput>) => setV({ ...v, ...patch })
  const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16) : '')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={v.id ? `Edit ${v.firstName} ${v.lastName}` : 'Add applicant'}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          await save.mutateAsync({ ...v, expectedSalary: v.expectedSalary.replace(/,/g, '') })
          onClose()
        }}
      >
        <Field label="First name">
          <Input required value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input required value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        </Field>
        <Field label="Middle name">
          <Input value={v.middleName} onChange={(e) => set({ middleName: e.target.value })} />
        </Field>
        <Field label="Applied on">
          <Input type="date" value={v.appliedDate} onChange={(e) => set({ appliedDate: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Position applied for">
          <Input required minLength={2} value={v.position} onChange={(e) => set({ position: e.target.value })} />
        </Field>
        <Field label="Department">
          <Select value={v.department} onChange={(e) => set({ department: e.target.value })}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Input placeholder="Walk-in, JobStreet, referral…" value={v.source} onChange={(e) => set({ source: e.target.value })} />
        </Field>
        <Field label="Expected monthly salary">
          <Input inputMode="decimal" value={v.expectedSalary} onChange={(e) => set({ expectedSalary: e.target.value })} />
        </Field>
        <Field label="Interview">
          <Input type="datetime-local" value={toLocal(v.interviewAt)} onChange={(e) => set({ interviewAt: e.target.value ? new Date(`${e.target.value}:00+08:00`).toISOString() : null })} />
        </Field>
        <Field label="Rating">
          <Select value={v.rating ?? ''} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <Textarea rows={3} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        {save.isError && <p className="col-span-2 text-sm text-danger">{errorText(save.error)}</p>}
        <Button type="submit" className="col-span-2" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Dialog>
  )
}
