import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowRight, Banknote, CalendarRange, ChartColumn, History, Landmark, Timer, Users } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Misc'
import { buttonVariants } from '@/components/ui/Button'
import { PesoBarChart, PesoHBarChart } from '@/components/charts/Charts'
import { PeriodStatusBadge } from '@/components/shared/StatusBadges'
import { PayrollStepper } from '@/components/shared/PayrollStepper'
import { useAudit, useEmployees, useOvertime, usePayrollLines, usePeriods } from '@/services/queries'
import { useAuth } from '@/store/auth'
import { formatDate, formatPeso, greeting } from '@/lib/format'
import { roleLabels } from '@/lib/permissions'
import { sum } from '@/lib/payroll'

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
}

export function DashboardPage() {
  const user = useAuth((s) => s.session?.user)
  const periods = usePeriods()
  const employees = useEmployees()
  const overtime = useOvertime()
  const audit = useAudit()

  const current = periods.data?.find((p) => p.status !== 'released')
  const lastReleased = periods.data?.find((p) => p.status === 'released')
  const lines = usePayrollLines(lastReleased?.id ?? '')

  const active = employees.data?.filter((e) => e.status !== 'resigned').length
  const pendingOt = overtime.data?.filter((o) => o.status === 'pending').length

  const trend = [...(periods.data ?? [])]
    .filter((p) => p.status === 'released')
    .reverse()
    .map((p) => ({ period: p.label.replace(/, \d{4}$/, ''), net: Number(p.net) }))

  const byDept = Object.entries(
    (lines.data ?? []).reduce<Record<string, string[]>>((acc, l) => {
      ;(acc[l.department] ??= []).push(l.grossPay)
      return acc
    }, {}),
  )
    .map(([department, values]) => ({ department, gross: Number(sum(values)) }))
    .sort((a, b) => b.gross - a.gross)

  const govTotal = lines.data ? sum(lines.data.flatMap((l) => [l.sss, l.philhealth, l.pagibig, l.withholdingTax])) : null

  const stats = [
    {
      icon: Banknote,
      label: 'Last Net Payroll',
      value: lastReleased ? formatPeso(lastReleased.net) : null,
      hint: lastReleased?.label ?? '',
      to: '/app/periods',
    },
    { icon: Users, label: 'Active Employees', value: active ?? null, hint: 'On payroll this cut-off', to: '/app/employees' },
    {
      icon: Landmark,
      label: 'Gov’t & Tax Withheld',
      value: govTotal ? formatPeso(govTotal) : null,
      hint: 'Last released cut-off',
      to: '/app/government',
    },
    { icon: Timer, label: 'Pending Overtime', value: pendingOt ?? null, hint: 'Awaiting approval', to: '/app/overtime' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{greeting()},</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{user?.name}</h1>
          <p className="mt-1.5 text-sm text-ink">
            Payroll overview · signed in as <b>{user && roleLabels[user.role]}</b>
          </p>
        </div>
        {current && (
          <Link to={`/app/periods/${current.id}`} className={buttonVariants()}>
            <CalendarRange className="size-4" /> Open {current.label}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} custom={i} variants={rise} initial="hidden" animate="show">
            <StatCard {...s} value={s.value ?? <Skeleton className="mt-1 h-7 w-24" />} />
          </motion.div>
        ))}
      </div>

      <motion.div custom={4} variants={rise} initial="hidden" animate="show">
        <Card className="p-5 sm:p-6">
          <CardHeader
            icon={CalendarRange}
            title={current ? `Current cut-off · ${current.label}` : 'Current cut-off'}
            action={current && <PeriodStatusBadge status={current.status} />}
          />
          {current ? (
            <>
              <PayrollStepper status={current.status} className="mt-6" />
              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-bg p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">
                  Pay date <b>{formatDate(current.payDate, 'MMMM d, yyyy')}</b> ·{' '}
                  {current.headcount ? `${current.headcount} employees computed` : 'Not computed yet'}
                </p>
                <Link to={`/app/periods/${current.id}`} className="group inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Continue processing <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </>
          ) : (
            <Skeleton className="mt-6 h-20" />
          )}
        </Card>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-5">
        <motion.div custom={5} variants={rise} initial="hidden" animate="show" className="xl:col-span-3">
          <Card className="h-full p-5 sm:p-6">
            <CardHeader icon={ChartColumn} title="Net payroll per cut-off" viewAllTo="/app/reports" />
            <div className="mt-4">
              {periods.isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <PesoBarChart data={trend} xKey="period" series={[{ key: 'net', name: 'Net pay' }]} />
              )}
            </div>
          </Card>
        </motion.div>
        <motion.div custom={6} variants={rise} initial="hidden" animate="show" className="xl:col-span-2">
          <Card className="h-full p-5 sm:p-6">
            <CardHeader icon={Users} title="Gross pay by department" />
            <p className="mt-1 text-xs text-muted">{lastReleased?.label}</p>
            <div className="mt-4">
              {lines.isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <PesoHBarChart data={byDept} labelKey="department" valueKey="gross" name="Gross pay" />
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div custom={7} variants={rise} initial="hidden" animate="show">
        <Card className="p-5 sm:p-6">
          <CardHeader icon={History} title="Recent activity" />
          <ul className="mt-4 divide-y divide-line">
            {audit.data?.slice(0, 6).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="text-ink">
                  <b className="text-navy">{a.actor}</b> {a.action.toLowerCase()} · <span className="text-muted">{a.target}</span>
                </span>
                <span className="text-xs text-muted">{formatDistanceToNowStrict(new Date(a.at), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>
    </div>
  )
}
