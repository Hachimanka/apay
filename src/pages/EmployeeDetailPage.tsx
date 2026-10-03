import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { differenceInMonths } from 'date-fns'
import { Banknote, BriefcaseBusiness, Landmark, Mail, Pencil, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Misc'
import { EmploymentBadge } from '@/components/shared/StatusBadges'
import { useEmployee } from '@/services/queries'
import { useAuth } from '@/store/auth'
import { useDetailCrumb } from '@/store/breadcrumb'
import { can } from '@/lib/permissions'
import { dailyRate, hourlyRate } from '@/lib/payroll'
import { formatDate, formatPeso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { EmployeeDialog } from './EmployeesPage'

function tenure(hireDate: string) {
  const months = differenceInMonths(new Date(), new Date(hireDate))
  if (months < 1) return 'Less than a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo${m > 1 ? 's' : ''}`].filter(Boolean).join(' ')
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const role = useAuth((s) => s.session?.user.role)
  const { data: e, isError } = useEmployee(id)
  const [editing, setEditing] = useState(false)
  useDetailCrumb(isError ? 'Not found' : e?.fullName)

  if (isError) return <p className="text-muted">Employee not found.</p>
  if (!e) return <Skeleton className="h-96" />

  return (
    <>
      <Card className="mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={e.fullName} className="size-16 text-lg ring-4" />
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
          </div>
        </div>
        {can(role, 'employees.manage') && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit employee
          </Button>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={BriefcaseBusiness} title="Employment">
          <Row label="Department" value={e.department} />
          <Row label="Position" value={e.position} />
          <Row label="Employment type" value={e.employmentType} />
          <Row label="Hire date" value={formatDate(e.hireDate)} />
          <Row label="Tenure" value={tenure(e.hireDate)} />
        </Section>

        <Section icon={Banknote} title="Compensation">
          <Row label="Monthly basic" value={formatPeso(e.monthlyBasic)} strong />
          <Row label="Daily rate" value={formatPeso(dailyRate(e.monthlyBasic).toFixed(2))} />
          <Row label="Hourly rate" value={formatPeso(hourlyRate(e.monthlyBasic).toFixed(2))} />
          <Row label="Tax status" value={e.taxStatus} />
        </Section>

        <Section icon={ShieldCheck} title="Government IDs">
          <Row label="SSS" value={e.govIds.sss} mono />
          <Row label="PhilHealth" value={e.govIds.philhealth} mono />
          <Row label="Pag-IBIG" value={e.govIds.pagibig} mono />
          <Row label="TIN" value={e.govIds.tin} mono />
        </Section>

        <Section icon={Landmark} title="Payout & contact">
          <Row label="Bank" value={e.bank.name} />
          <Row label="Account no." value={e.bank.account} mono />
          <Row
            label="Email"
            value={
              <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="size-3.5" /> {e.email}
              </a>
            }
          />
        </Section>
      </div>

      {editing && <EmployeeDialog employee={e} onClose={() => setEditing(false)} />}
    </>
  )
}

function Section({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={icon} title={title} className="mb-3" />
      <dl className="divide-y divide-line">{children}</dl>
    </Card>
  )
}

function Row({ label, value, strong, mono }: { label: string; value: ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right', strong ? 'font-bold text-navy' : 'font-medium text-ink', mono && 'tabular-nums')}>{value}</dd>
    </div>
  )
}
