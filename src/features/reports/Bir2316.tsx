import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ReportCell } from '@/services/types'
import { formatDate, formatPeso } from '@/lib/format'

const peso = (v: ReportCell) => formatPeso(String(v ?? 0))
const day = (v: ReportCell) => (v ? formatDate(String(v)) : '—')

/**
 * One employee's BIR Form 2316 figures (checklist #61), laid out in the form's order so HR can copy them onto the
 * official form (or the eBIRForms package). Printable.
 */
export function Bir2316({ row, year }: { row: Record<string, ReportCell>; year: string }) {
  const lines: [string, string, string][] = [
    ['Part IV-A', 'Gross compensation income from present employer', peso(row.gross)],
    ['Part IV-A', '13th month pay and other benefits (exempt, up to ₱90,000)', peso(row.thirteenthAndBenefits)],
    ['Part IV-A', 'De minimis benefits and other non-taxable compensation', peso(row.otherNonTaxable)],
    ['Part IV-A', 'SSS, PhilHealth, Pag-IBIG and union dues (employee share)', peso(row.contributions)],
    ['Part IV-A', 'Taxable compensation income from present employer', peso(row.taxable)],
    ['Part IV-A', 'Tax due', peso(row.taxDue)],
    ['Part IV-A', 'Taxes withheld by present employer', peso(row.taxWithheld)],
    ['', Number(row.difference) < 0 ? 'Over-withheld (refund to employee)' : 'Still due (deduct from employee)', peso(Math.abs(Number(row.difference ?? 0)))],
  ]
  return (
    <div className="text-sm">
      <div className="mb-4 rounded-xl bg-bg p-4">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Certificate of Compensation Payment / Tax Withheld · {year}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted">Employee</dt>
          <dd className="font-semibold text-navy">{String(row.name)}</dd>
          <dt className="text-muted">TIN</dt>
          <dd className="text-navy">{row.tin ? String(row.tin) : <span className="text-danger">Missing — add on the profile</span>}</dd>
          <dt className="text-muted">Birthday</dt>
          <dd className="text-navy">{day(row.birthday)}</dd>
          <dt className="text-muted">Period</dt>
          <dd className="text-navy">
            {String(row.hireDate) > `${year}-01-01` ? day(row.hireDate) : `Jan 1, ${year}`} –{' '}
            {row.separationDate && String(row.separationDate) < `${year}-12-31` ? day(row.separationDate) : `Dec 31, ${year}`}
          </dd>
          <dt className="text-muted">Address</dt>
          <dd className="text-navy">{String(row.address || '—')}</dd>
        </dl>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-line">
          {lines.map(([part, label, value]) => (
            <tr key={label}>
              <td className="py-2 pr-2 text-xs whitespace-nowrap text-muted">{part}</td>
              <td className="py-2 text-ink">{label}</td>
              <td className="py-2 text-right font-semibold whitespace-nowrap text-navy tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">From released payslips only. Add compensation from a previous employer if the employee had one this year.</p>
      <Button variant="outline" size="sm" className="mt-4 print:hidden" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
    </div>
  )
}
