import { useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { differenceInMonths } from 'date-fns'
import {
  Award,
  Banknote,
  BriefcaseBusiness,
  Gavel,
  GraduationCap,
  HeartPulse,
  History,
  Landmark,
  Laptop,
  Mail,
  Pencil,
  Presentation,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Misc'
import { EmploymentBadge } from '@/components/shared/StatusBadges'
import { useEmployee, useEmployeeRecords, useShifts } from '@/services/queries'
import { shiftSummary } from '@/features/settings/ShiftCodes'
import type { EmployeeProfile, EmployeeRecord, EmployeeRecordKind } from '@/services/types'
import { useAuth } from '@/store/auth'
import { useDetailCrumb } from '@/store/breadcrumb'
import { can } from '@/lib/permissions'
import { PrivacySection } from '@/features/employees/PrivacySection'
import { dailyRate, hourlyRate } from '@/lib/payroll'
import { formatDate, formatPeso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { taxStatusLabels } from '@/features/employees/employeeForm'
import { LoanLedger } from '@/features/loans/LoanLedger'
import { CrewMovements } from '@/pages/FleetPage'
import { FinalPaySection } from '@/features/employees/FinalPaySection'
import { EmployeeDialog } from '@/features/employees/EmployeeDialog'
import { RecordSection } from '@/features/employees/RecordSection'
import { civilStatusLabels, daysToExpiry, genderLabels, payBasisLabels } from '@/features/employees/records'

function tenure(hireDate: string) {
  const months = differenceInMonths(new Date(), new Date(hireDate))
  if (months < 1) return 'Less than a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo${m > 1 ? 's' : ''}`].filter(Boolean).join(' ')
}

/** The employee's 201 file, one tab per area. The tab lives in the URL (?tab=) so it survives reloads and can be linked. */
const tabs: { id: string; label: string; kinds: EmployeeRecordKind[] }[] = [
  { id: 'overview', label: 'Overview', kinds: [] },
  { id: 'family', label: 'Family', kinds: ['child'] },
  { id: 'background', label: 'Education & work', kinds: ['education', 'employment_history'] },
  { id: 'development', label: 'Development', kinds: ['certification', 'training', 'appraisal'] },
  { id: 'health', label: 'Health & conduct', kinds: ['medical', 'disciplinary'] },
  { id: 'assets', label: 'Assets', kinds: ['asset'] },
  { id: 'movement', label: 'Movement', kinds: ['movement'] },
  { id: 'sea-service', label: 'Sea service', kinds: [] },
  { id: 'loans', label: 'Loans', kinds: [] },
  { id: 'final-pay', label: 'Final pay', kinds: [] },
  { id: 'privacy', label: 'Privacy', kinds: [] },
]

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const role = useAuth((s) => s.session?.user.role)
  const { data: e, isError } = useEmployee(id)
  const { data: records } = useEmployeeRecords(id)
  const [editing, setEditing] = useState(false)
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'overview'
  const canManage = can(role, 'employees.manage')
  useDetailCrumb(isError ? 'Not found' : e?.fullName)

  if (isError) return <p className="text-muted">Employee not found.</p>
  if (!e) return <Skeleton className="h-96" />

  const section = (kind: EmployeeRecordKind, icon: LucideIcon, className?: string) => (
    <RecordSection employeeId={e.id} kind={kind} icon={icon} records={records} canManage={canManage} className={className} />
  )

  return (
    <>
      <Card className="mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={e.fullName} src={e.avatarUrl} className="size-20 text-xl ring-4" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{e.fullName}</h1>
            <EmploymentBadge status={e.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {e.position} · {e.department}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge size="sm" tone="neutral">
              {e.employeeNo}
            </Badge>
            <Badge size="sm">{e.employmentType}</Badge>
            {e.level && (
              <Badge size="sm" tone="violet">
                {e.level}
              </Badge>
            )}
            <LicenseAlert records={records} />
          </div>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit employee
          </Button>
        )}
      </Card>

      <div role="tablist" aria-label="Employee file" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const count = records?.filter((r) => t.kinds.includes(r.kind)).length ?? 0
          const on = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
                on ? 'bg-primary text-white shadow-card' : 'text-muted hover:bg-primary-50 hover:text-primary',
              )}
            >
              {t.label}
              {count > 0 && <span className={cn('ml-1.5 text-xs', on ? 'text-white/80' : 'text-muted/80')}>{count}</span>}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <Overview e={e} />}
        {tab === 'family' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Section icon={Users} title="Spouse & civil status">
              <Row label="Civil status" value={e.civilStatus ? civilStatusLabels[e.civilStatus] : <NotSet />} />
              <Row label="Spouse’s name" value={e.spouseName || <NotSet />} />
            </Section>
            {section('child', Users)}
          </div>
        )}
        {tab === 'background' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {section('education', GraduationCap)}
            {section('employment_history', BriefcaseBusiness)}
          </div>
        )}
        {tab === 'development' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {section('certification', Award)}
            {section('training', Presentation)}
            {section('appraisal', Star, 'lg:col-span-2')}
          </div>
        )}
        {tab === 'health' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {section('medical', HeartPulse)}
            {section('disciplinary', Gavel)}
          </div>
        )}
        {tab === 'assets' && section('asset', Laptop)}
        {tab === 'movement' && section('movement', History)}
        {tab === 'sea-service' && <CrewMovements employeeId={e.id} canManage={canManage} />}
        {tab === 'loans' && <LoanLedger employeeId={e.id} />}
        {tab === 'final-pay' && <FinalPaySection employee={e} />}
        {tab === 'privacy' && <PrivacySection employee={e} canManage={canManage} />}
      </div>

      {editing && <EmployeeDialog employee={e} onClose={() => setEditing(false)} />}
    </>
  )
}

/** Badge when a certification or license has expired or expires within 90 days. */
function LicenseAlert({ records }: { records: EmployeeRecord[] | undefined }) {
  const days = (records ?? [])
    .filter((r) => r.kind === 'certification')
    .map((r) => daysToExpiry(r.data.expiryDate))
    .filter((d): d is number => d !== null)
  if (days.some((d) => d < 0))
    return (
      <Badge size="sm" tone="danger">
        License expired
      </Badge>
    )
  if (days.some((d) => d <= 90))
    return (
      <Badge size="sm" tone="warning">
        License expiring
      </Badge>
    )
  return null
}

function Overview({ e }: { e: EmployeeProfile }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section icon={UserRound} title="Personal information" note="Mobile, present address and emergency contact are also kept up to date by the employee in AZONE">
        <Row label="Full name" value={[e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')} wrap />
        <Row label="Date of birth" value={e.birthday ? formatDate(e.birthday, 'MMMM d, yyyy') : <NotSet />} />
        <Row label="Gender" value={e.gender ? genderLabels[e.gender] : <NotSet />} />
        <Row label="Civil status" value={e.civilStatus ? civilStatusLabels[e.civilStatus] : <NotSet />} />
        <Row
          label="Mobile"
          value={
            e.phone ? (
              <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="text-primary hover:underline">
                {e.phone}
              </a>
            ) : (
              <NotSet />
            )
          }
        />
        <Row label="Present address" value={e.address || <NotSet />} wrap />
        <Row label="Permanent address" value={e.permanentAddress || <NotSet />} wrap />
        <Row
          label="Emergency contact"
          value={
            e.emergencyContact.name ? (
              <span className="block">
                {e.emergencyContact.name}
                {e.emergencyContact.relation && <span className="text-muted"> · {e.emergencyContact.relation}</span>}
                {e.emergencyContact.phone && <span className="block text-xs text-muted">{e.emergencyContact.phone}</span>}
              </span>
            ) : (
              <NotSet />
            )
          }
          wrap
        />
      </Section>

      <Section icon={BriefcaseBusiness} title="Employment status">
        <Row label="Position title" value={e.position} />
        <Row label="Department" value={e.department} />
        <Row label="Level" value={e.level || <NotSet />} />
        <Row label="Employment type" value={e.employmentType} />
        <Row label="Manager" value={e.manager || <NotSet />} />
        <Row label="Shift" value={<ShiftName id={e.shiftId} />} wrap />
        <Row label="Hire date" value={formatDate(e.hireDate)} />
        <Row label="Tenure" value={tenure(e.hireDate)} />
      </Section>

      <Section icon={Banknote} title="Compensation">
        <Row label="Monthly rate (basic)" value={formatPeso(e.monthlyBasic)} strong />
        <Row label="Pay basis" value={payBasisLabels[e.payBasis ?? 'monthly']} />
        <Row label="Daily rate" value={formatPeso(dailyRate(e.monthlyBasic).toFixed(2))} />
        <Row label="Hourly rate" value={formatPeso(hourlyRate(e.monthlyBasic).toFixed(2))} />
        <Row label="Tax status" value={taxStatusLabels[e.taxStatus]} />
      </Section>

      <Section icon={Sparkles} title="Skills">
        {e.skills?.length ? (
          <div className="flex flex-wrap gap-2 py-2.5">
            {e.skills.map((s) => (
              <Badge key={s} size="sm" className="normal-case">
                {s}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="py-2.5 text-sm">
            <NotSet />
          </p>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Government IDs">
        <Row label="SSS" value={e.govIds.sss} mono />
        <Row label="PhilHealth" value={e.govIds.philhealth} mono />
        <Row label="Pag-IBIG" value={e.govIds.pagibig} mono />
        <Row label="TIN" value={e.govIds.tin} mono />
      </Section>

      <Section icon={Landmark} title="Payout & sign-in">
        <Row label="Bank" value={e.bank.name} />
        <Row label="Account no." value={e.bank.account} mono />
        <Row
          label="AZONE sign-in"
          value={
            <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Mail className="size-3.5" /> {e.email}
            </a>
          }
        />
      </Section>
    </div>
  )
}

function Section({ icon, title, note, children }: { icon: LucideIcon; title: string; note?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={icon} title={title} className={note ? 'mb-1' : 'mb-3'} />
      {note && <p className="mb-3 text-xs text-muted">{note}</p>}
      <dl className="divide-y divide-line">{children}</dl>
    </Card>
  )
}

function Row({ label, value, strong, mono, wrap }: { label: string; value: ReactNode; strong?: boolean; mono?: boolean; wrap?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4 py-2.5 text-sm', wrap ? 'items-start' : 'items-center')}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right',
          wrap ? 'break-words' : 'truncate',
          strong ? 'font-bold text-navy' : 'font-medium text-ink',
          mono && 'tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ShiftName({ id }: { id?: string | null }) {
  const { data } = useShifts()
  if (!id) return <span>Company default · Mon–Fri</span>
  const s = data?.find((x) => x.id === id)
  if (!s) return <span className="text-muted">…</span>
  return (
    <span className="block">
      {s.code} · {s.name}
      <span className="block text-xs text-muted">{shiftSummary(s)}</span>
    </span>
  )
}

const NotSet = () => <span className="font-normal text-muted/70 italic">Not set yet</span>
