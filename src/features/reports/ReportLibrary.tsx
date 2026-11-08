import { useMemo, useState } from 'react'
import {
  Anchor,
  BadgeAlert,
  GraduationCap,
  Ship,
  BadgeCheck,
  Building2,
  CalendarX,
  Clock,
  Download,
  FileText,
  Hourglass,
  Landmark,
  Network,
  PieChart,
  Plane,
  Printer,
  TrendingDown,
  UserSquare,
  Wallet,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useReport, useReportCatalog } from '@/services/queries'
import type { Report, ReportCell, ReportColumn, ReportInfo, ReportParams } from '@/services/types'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatPeso } from '@/lib/format'
import { manilaToday, shiftDay } from '@/lib/timeRecords'
import { cn } from '@/lib/cn'
import { OrgChart } from './OrgChart'
import { Bir2316 } from './Bir2316'

/** Card text for each report (titles also come back from the API) */
export const reportMeta: Record<string, { title: string; text: string; icon: LucideIcon }> = {
  demographics: { title: 'Manpower demographics', text: 'Headcount by department, gender, civil status, type, level and age.', icon: PieChart },
  'org-chart': { title: 'Organizational chart', text: 'Who reports to whom, by department.', icon: Network },
  attrition: { title: 'Attrition rate', text: 'Hires, separations and attrition per month.', icon: TrendingDown },
  'employee-profile': { title: 'Employee profile', text: 'Master list with personal, job and government details.', icon: UserSquare },
  tenure: { title: 'Tenure', text: 'Years of service and tenure bands.', icon: Hourglass },
  absences: { title: 'Absences', text: 'Absences and leave without pay, with dates.', icon: CalendarX },
  'perfect-attendance': { title: 'Perfect attendance', text: 'No absence, late or undertime in the range.', icon: BadgeCheck },
  'leave-monitoring': { title: 'Leave monitoring', text: 'Leave used, converted and left per employee.', icon: Plane },
  tardiness: { title: 'Tardiness', text: 'Times and minutes late, and undertime.', icon: Clock },
  'bir-2316': { title: 'BIR Form 2316', text: 'Compensation and tax withheld for the year; printable per employee.', icon: FileText },
  'sss-remittance': { title: 'SSS contributions & loans', text: 'Monthly remittance list with MSC and EC.', icon: Landmark },
  'philhealth-remittance': { title: 'PhilHealth contributions', text: 'Monthly remittance list.', icon: Landmark },
  'pagibig-remittance': { title: 'Pag-IBIG contributions & loans', text: 'Monthly remittance list.', icon: Landmark },
  'cost-center': { title: 'Cost center', text: 'Payroll cost by department.', icon: Building2 },
  'payroll-cost': { title: 'Payroll cost', text: 'Gross pay plus employer contributions per cut-off.', icon: Wallet },
  'overtime-cost': { title: 'Overtime cost', text: 'Overtime, holiday and night pay per employee.', icon: Timer },
  'crew-movement': { title: 'Crew movement', text: 'Every stint aboard, per seafarer, across vessels.', icon: Anchor },
  'vessel-manning': { title: 'Vessel manning', text: 'Crew aboard each vessel against its complement.', icon: Ship },
  'license-expiry': { title: 'License expiry', text: 'Licenses expired or expiring within 90 days.', icon: BadgeAlert },
  cadets: { title: 'Cadetship', text: 'Cadets by stage with sea-service progress.', icon: GraduationCap },
}

const groups = ['Workforce', 'Attendance', 'Government', 'Payroll', 'Shipping'] as const

export function formatCell(v: ReportCell, type: ReportColumn['type']) {
  if (v === null || v === '') return '—'
  if (type === 'money') return formatPeso(String(v))
  if (type === 'percent') return `${v}%`
  if (type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v)
  if (type === 'number' && typeof v === 'number') return v.toLocaleString('en-PH')
  return String(v)
}

/** CSV rows with the column labels as headers */
export function reportCsv(r: Report) {
  const rows = r.totals ? [...r.rows, r.totals] : r.rows
  return rows.map((row) => Object.fromEntries(r.columns.map((c) => [c.label, row[c.key] ?? ''])))
}

/** Every Phase 4 report (checklist #52–70), grouped; opening one shows it as a table with CSV export. */
export function ReportLibrary() {
  const { data } = useReportCatalog()
  const [open, setOpen] = useState<ReportInfo | null>(null)
  const byGroup = (g: string) => (data ?? []).filter((r) => r.group === g)

  return (
    <div className="space-y-6">
      {groups.map((g) =>
        byGroup(g).length ? (
          <section key={g}>
            <h2 className="mb-3 text-lg font-bold">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {byGroup(g).map((r) => {
                const m = reportMeta[r.key] ?? { title: r.key, text: '', icon: FileText }
                const Icon = m.icon
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setOpen(r)}
                    className="card-hover flex flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-3 font-bold text-navy">{m.title}</span>
                    <span className="mt-1 text-sm text-muted">{m.text}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null,
      )}
      {open && <ReportViewer info={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function defaults(): Required<ReportParams> {
  const today = manilaToday()
  return { year: today.slice(0, 4), month: today.slice(0, 7), from: shiftDay(today, -30), to: today }
}

function ReportViewer({ info, onClose }: { info: ReportInfo; onClose: () => void }) {
  const [params, setParams] = useState(defaults)
  const used = useMemo(() => Object.fromEntries(info.params.map((p) => [p, params[p]])) as ReportParams, [info.params, params])
  const { data: r, isLoading, error } = useReport(info.key, used)
  const [view, setView] = useState<'table' | 'chart'>(info.key === 'org-chart' ? 'chart' : 'table')
  const [cert, setCert] = useState<Record<string, ReportCell> | null>(null)
  const meta = reportMeta[info.key]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg print:static print:bg-white" role="dialog" aria-label={meta?.title ?? info.key}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line bg-surface px-5 py-4 print:hidden">
        <div className="mr-auto">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{info.group} report</p>
          <h2 className="text-xl font-bold text-navy">{r?.title ?? meta?.title}</h2>
        </div>
        {info.params.includes('year') && (
          <Field label="Year">
            <Input type="number" min={2000} max={2100} className="w-28 py-2" value={params.year} onChange={(e) => setParams((p) => ({ ...p, year: e.target.value }))} />
          </Field>
        )}
        {info.params.includes('month') && (
          <Field label="Month">
            <Input type="month" className="py-2" value={params.month} onChange={(e) => setParams((p) => ({ ...p, month: e.target.value }))} />
          </Field>
        )}
        {info.params.includes('from') && (
          <>
            <Field label="From">
              <Input type="date" className="py-2" value={params.from} onChange={(e) => setParams((p) => ({ ...p, from: e.target.value }))} />
            </Field>
            <Field label="To">
              <Input type="date" className="py-2" value={params.to} onChange={(e) => setParams((p) => ({ ...p, to: e.target.value }))} />
            </Field>
          </>
        )}
        {info.key === 'org-chart' && (
          <Button variant="outline" size="sm" onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}>
            {view === 'chart' ? 'Table view' : 'Chart view'}
          </Button>
        )}
        <Button variant="soft" size="sm" disabled={!r?.rows.length} onClick={() => r && downloadCsv(`${r.key}${info.params.length ? `-${Object.values(used).join('_')}` : ''}.csv`, reportCsv(r))}>
          <Download className="size-4" /> CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 print:overflow-visible">
        {error ? (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">{error.message}</p>
        ) : isLoading || !r ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{r.description}</p>
            {view === 'chart' && info.key === 'org-chart' ? (
              <OrgChart rows={r.rows} />
            ) : (
              <ReportTable report={r} onRowClick={info.key === 'bir-2316' ? setCert : undefined} />
            )}
            {r.notes?.map((n) => (
              <p key={n} className="mt-3 text-xs text-muted">
                {n}
              </p>
            ))}
          </>
        )}
      </div>

      {cert && (
        <Dialog open onOpenChange={(o) => !o && setCert(null)} title="BIR Form 2316 summary" description={String(cert.name)}>
          <Bir2316 row={cert} year={params.year} />
        </Dialog>
      )}
    </div>
  )
}

export function ReportTable({ report, onRowClick }: { report: Report; onRowClick?: (row: Record<string, ReportCell>) => void }) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null)
  const rows = useMemo(() => {
    if (!sort) return report.rows
    const col = report.columns.find((c) => c.key === sort.key)
    const num = col?.type === 'money' || col?.type === 'number' || col?.type === 'percent'
    return [...report.rows].sort((a, b) => {
      const x = a[sort.key] ?? ''
      const y = b[sort.key] ?? ''
      const c = num ? Number(x) - Number(y) : String(x).localeCompare(String(y))
      return sort.desc ? -c : c
    })
  }, [report, sort])

  if (!report.rows.length) return <Card className="p-10 text-center text-sm text-muted">Nothing to show for these dates.</Card>
  const right = (c: ReportColumn) => c.type === 'money' || c.type === 'number' || c.type === 'percent'
  return (
    <Card className="overflow-x-auto print:shadow-none">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-bg text-xs text-muted">
          <tr>
            {report.columns.map((c) => (
              <th key={c.key} className={cn('px-3 py-2.5 font-semibold whitespace-nowrap', right(c) ? 'text-right' : 'text-left')}>
                <button
                  type="button"
                  className="hover:text-primary"
                  onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: right(c) }))}
                >
                  {c.label}
                  {sort?.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => (
            <tr key={i} className={cn(onRowClick && 'cursor-pointer hover:bg-primary-50/50')} onClick={() => onRowClick?.(row)}>
              {report.columns.map((c) => (
                <td key={c.key} className={cn('px-3 py-2', right(c) ? 'text-right tabular-nums' : 'text-ink', c === report.columns[0] && 'font-medium text-navy')}>
                  {formatCell(row[c.key] ?? null, c.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {report.totals && (
          <tfoot className="border-t-2 border-line font-bold text-navy">
            <tr>
              {report.columns.map((c) => (
                <td key={c.key} className={cn('px-3 py-2.5', right(c) && 'text-right tabular-nums')}>
                  {report.totals![c.key] !== undefined ? formatCell(report.totals![c.key], c.type) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  )
}
