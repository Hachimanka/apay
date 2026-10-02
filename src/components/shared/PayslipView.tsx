import type { PayrollLine, PayrollPeriod } from '@/services/types'
import { formatPeso } from '@/lib/format'

/** A single employee payslip, used in previews and the Payslips module. */
export function PayslipView({ line, period }: { line: PayrollLine; period: PayrollPeriod }) {
  const earnings = [
    ['Basic Pay', line.basicPay],
    ['Overtime', line.overtimePay],
    ['Allowances', line.allowances],
    ['Absences / Unpaid leave', `-${line.absencesDeduction}`],
    ['Late / Undertime', `-${line.lateDeduction}`],
  ]
  const deductions = [
    ['SSS', line.sss],
    ['PhilHealth', line.philhealth],
    ['Pag-IBIG', line.pagibig],
    ['Withholding Tax', line.withholdingTax],
    ['Loans & Others', line.otherDeductions],
  ]
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-end justify-between bg-gradient-to-br from-primary to-primary-700 p-5 text-white">
        <div>
          <p className="text-xl font-extrabold">AZNAR</p>
          <p className="text-xs opacity-80">Payslip · {period.label}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold">{line.name}</p>
          <p className="opacity-80">
            {line.employeeNo} · {line.department}
          </p>
        </div>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <Section title="Earnings" rows={earnings} total={['Gross Pay', line.grossPay]} />
        <Section title="Deductions" rows={deductions} total={['Total Deductions', line.totalDeductions]} />
      </div>
      <div className="mx-5 mb-5 flex items-center justify-between rounded-xl bg-primary-50 p-4">
        <span className="font-semibold text-navy">Net Pay</span>
        <span className="text-xl font-extrabold text-primary">{formatPeso(line.netPay)}</span>
      </div>
    </div>
  )
}

function Section({ title, rows, total }: { title: string; rows: string[][]; total: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider text-muted uppercase">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {rows.map(([label, amount]) => (
          <li key={label} className="flex justify-between">
            <span className="text-ink">{label}</span>
            <span className="text-navy tabular-nums">{formatPeso(amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-bold text-navy">
        <span>{total[0]}</span>
        <span className="tabular-nums">{formatPeso(total[1])}</span>
      </p>
    </div>
  )
}
