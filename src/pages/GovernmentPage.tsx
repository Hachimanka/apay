import { useState } from 'react'
import { Download, Info } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/Misc'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PeriodSelect } from '@/components/shared/PeriodSelect'
import { usePayrollLines } from '@/services/queries'
import { BIR_SEMI_MONTHLY, PAGIBIG, PHILHEALTH, SSS, sum } from '@/lib/payroll'
import { downloadCsv } from '@/lib/csv'
import { formatPeso } from '@/lib/format'

const pct = (v: string) => `${Number(v) * 100}%`

export function GovernmentPage() {
  const [periodId, setPeriodId] = useState('')
  const { data: lines, isLoading } = usePayrollLines(periodId)

  const rows = lines
    ? [
        { agency: 'SSS', employee: sum(lines.map((l) => l.sss)), employer: sum(lines.map((l) => l.employer.sss)) },
        { agency: 'PhilHealth', employee: sum(lines.map((l) => l.philhealth)), employer: sum(lines.map((l) => l.employer.philhealth)) },
        { agency: 'Pag-IBIG (HDMF)', employee: sum(lines.map((l) => l.pagibig)), employer: sum(lines.map((l) => l.employer.pagibig)) },
        { agency: 'BIR Withholding Tax', employee: sum(lines.map((l) => l.withholdingTax)), employer: '0.00' },
      ]
    : []

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Government Deductions"
        description="Statutory contributions and withholding tax to remit per cut-off."
        actions={<PeriodSelect value={periodId} onChange={setPeriodId} onlyComputed />}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-bold text-navy">Remittance summary</h2>
          <Button
            variant="soft"
            size="sm"
            disabled={!lines?.length}
            onClick={() =>
              downloadCsv(
                `gov-remittance-${periodId}.csv`,
                (lines ?? []).map((l) => ({
                  'Employee No': l.employeeNo,
                  Name: l.name,
                  'SSS EE': l.sss,
                  'SSS ER': l.employer.sss,
                  'PhilHealth EE': l.philhealth,
                  'PhilHealth ER': l.employer.philhealth,
                  'Pag-IBIG EE': l.pagibig,
                  'Pag-IBIG ER': l.employer.pagibig,
                  'Withholding Tax': l.withholdingTax,
                })),
              )
            }
          >
            <Download className="size-4" /> Export per employee
          </Button>
        </div>
        {isLoading || !periodId ? (
          <Skeleton className="m-5 h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-bg text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="px-5 py-3">Agency</th>
                  <th className="px-5 py-3 text-right">Employee share</th>
                  <th className="px-5 py-3 text-right">Employer share</th>
                  <th className="px-5 py-3 text-right">Total to remit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.agency} className="hover:bg-primary-50/50">
                    <td className="px-5 py-3 font-semibold text-navy">{r.agency}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPeso(r.employee)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPeso(r.employer)}</td>
                    <td className="px-5 py-3 text-right font-bold text-navy tabular-nums">{formatPeso(sum([r.employee, r.employer]))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-bg font-bold text-navy">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatPeso(sum(rows.map((r) => r.employee)))}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatPeso(sum(rows.map((r) => r.employer)))}</td>
                  <td className="px-5 py-3 text-right text-primary tabular-nums">{formatPeso(sum(rows.flatMap((r) => [r.employee, r.employer])))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mt-8 mb-4 text-lg font-bold">Contribution tables in use</h2>
      <div className="grid gap-5 lg:grid-cols-3">
        <RateCard
          title="SSS"
          rows={[
            ['Total rate', pct(SSS.rate)],
            ['Employee / Employer', `${pct(SSS.employeeRate)} / ${pct(SSS.employerRate)}`],
            ['Monthly salary credit', `${formatPeso(SSS.mscMin)} – ${formatPeso(SSS.mscMax)}`],
          ]}
        />
        <RateCard
          title="PhilHealth"
          rows={[
            ['Premium rate', pct(PHILHEALTH.rate)],
            ['Employee / Employer', '50% / 50%'],
            ['Salary floor – ceiling', `${formatPeso(PHILHEALTH.floor)} – ${formatPeso(PHILHEALTH.ceiling)}`],
          ]}
        />
        <RateCard
          title="Pag-IBIG"
          rows={[
            ['Employee / Employer', `${pct(PAGIBIG.employeeRate)} / ${pct(PAGIBIG.employerRate)}`],
            ['Max fund salary', formatPeso(PAGIBIG.maxFundSalary)],
            ['Max monthly EE share', formatPeso(Number(PAGIBIG.maxFundSalary) * Number(PAGIBIG.employeeRate))],
          ]}
        />
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <CardHeader title="BIR withholding tax — semi-monthly (TRAIN)" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs font-semibold text-muted">
              <tr>
                <th className="py-2">Taxable income over</th>
                <th className="py-2 text-right">Fixed tax</th>
                <th className="py-2 text-right">+ Rate on excess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BIR_SEMI_MONTHLY.map((b) => (
                <tr key={b.over}>
                  <td className="py-2.5 text-navy">{formatPeso(b.over)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatPeso(b.base)}</td>
                  <td className="py-2.5 text-right tabular-nums">{pct(b.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-xs text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          Rates follow the 2025 schedules. Confirm against the latest SSS, PhilHealth, Pag-IBIG and BIR circulars before each payroll year.
        </p>
      </Card>
    </>
  )
}

function RateCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card className="card-hover p-5">
      <p className="font-bold text-navy">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold text-navy">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
