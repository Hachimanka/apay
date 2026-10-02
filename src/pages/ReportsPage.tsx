import { useQueries } from '@tanstack/react-query'
import { ChartColumn, Download, FileSpreadsheet, Landmark, Users } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/Misc'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PesoBarChart } from '@/components/charts/Charts'
import { api } from '@/services/api'
import { keys, usePeriods } from '@/services/queries'
import { downloadCsv } from '@/lib/csv'
import { formatPeso } from '@/lib/format'
import { sum } from '@/lib/payroll'

export function ReportsPage() {
  const periods = usePeriods()
  const computed = [...(periods.data ?? [])].filter((p) => p.headcount > 0).reverse()
  const lineQueries = useQueries({ queries: computed.map((p) => ({ queryKey: keys.lines(p.id), queryFn: () => api.getPayrollLines(p.id) })) })
  const ready = lineQueries.every((q) => q.data)

  const rows = computed.map((p, i) => {
    const lines = lineQueries[i]?.data ?? []
    const contributions = sum(lines.flatMap((l) => [l.sss, l.philhealth, l.pagibig]))
    const tax = sum(lines.map((l) => l.withholdingTax))
    return {
      period: p.label.replace(/, \d{4}$/, ''),
      fullLabel: p.label,
      net: Number(p.net),
      tax: Number(tax),
      contributions: Number(contributions),
      gross: p.gross,
      employer: p.employerContributions,
      headcount: p.headcount,
    }
  })

  const reports = [
    {
      icon: FileSpreadsheet,
      title: 'Payroll summary',
      text: 'Gross, deductions and net per cut-off.',
      file: 'payroll-summary.csv',
      data: () =>
        rows.map((r) => ({
          Period: r.fullLabel,
          Employees: r.headcount,
          Gross: r.gross,
          'Net Pay': r.net.toFixed(2),
          'Withholding Tax': r.tax.toFixed(2),
          'EE Contributions': r.contributions.toFixed(2),
          'ER Contributions': r.employer,
        })),
    },
    {
      icon: Landmark,
      title: 'Alphalist (BIR 1604-C)',
      text: 'Year-to-date compensation and tax withheld per employee.',
      file: 'alphalist.csv',
      data: () => alphalist(lineQueries.map((q) => q.data ?? [])),
    },
    {
      icon: Users,
      title: 'Bank payroll file',
      text: 'Net pay per employee for the latest released cut-off.',
      file: 'bank-file.csv',
      data: () => (lineQueries.at(-1)?.data ?? []).map((l) => ({ 'Employee No': l.employeeNo, Name: l.name, 'Net Pay': l.netPay })),
    },
  ]

  return (
    <>
      <PageHeader eyebrow="Compliance" title="Reports" description="Payroll cost trends and exportable reports for Finance and government filing." />

      <Card className="p-5 sm:p-6">
        <CardHeader icon={ChartColumn} title="Where each cut-off’s gross pay goes" />
        <p className="mt-1 text-xs text-muted">
          Net pay to employees, withholding tax, and employee-share contributions (SSS, PhilHealth, Pag-IBIG). Loans are excluded.
        </p>
        <div className="mt-4">
          {ready && rows.length ? (
            <PesoBarChart
              data={rows}
              xKey="period"
              height={300}
              series={[
                { key: 'net', name: 'Net pay' },
                { key: 'tax', name: 'Withholding tax' },
                { key: 'contributions', name: 'Contributions' },
              ]}
            />
          ) : (
            <Skeleton className="h-72" />
          )}
        </div>

        {/* Table view of the same data */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-bg text-left text-xs font-semibold text-muted">
              <tr>
                <th className="px-4 py-2.5">Cut-off</th>
                <th className="px-4 py-2.5 text-right">Employees</th>
                <th className="px-4 py-2.5 text-right">Gross</th>
                <th className="px-4 py-2.5 text-right">Net pay</th>
                <th className="px-4 py-2.5 text-right">Withholding tax</th>
                <th className="px-4 py-2.5 text-right">Contributions (EE)</th>
                <th className="px-4 py-2.5 text-right">Employer share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.fullLabel} className="hover:bg-primary-50/50">
                  <td className="px-4 py-2.5 font-semibold text-navy">{r.fullLabel}</td>
                  <td className="px-4 py-2.5 text-right">{r.headcount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.gross)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.net)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.tax)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.contributions)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.employer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mt-8 mb-4 text-lg font-bold">Downloads</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map(({ icon: Icon, title, text, file, data }) => (
          <Card key={title} className="card-hover flex flex-col p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Icon className="size-5" />
            </span>
            <p className="mt-4 font-bold text-navy">{title}</p>
            <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
            <Button variant="outline" size="sm" className="mt-4" disabled={!ready} onClick={() => downloadCsv(file, data())}>
              <Download className="size-4" /> Download CSV
            </Button>
          </Card>
        ))}
      </div>
    </>
  )
}

function alphalist(perPeriod: Awaited<ReturnType<typeof api.getPayrollLines>>[]) {
  const byEmp = new Map<string, { name: string; gross: string[]; tax: string[] }>()
  for (const lines of perPeriod)
    for (const l of lines) {
      const e = byEmp.get(l.employeeNo) ?? { name: l.name, gross: [], tax: [] }
      e.gross.push(l.grossPay)
      e.tax.push(l.withholdingTax)
      byEmp.set(l.employeeNo, e)
    }
  return [...byEmp].map(([no, e]) => ({ 'Employee No': no, Name: e.name, 'Gross Compensation': sum(e.gross), 'Tax Withheld': sum(e.tax) }))
}
