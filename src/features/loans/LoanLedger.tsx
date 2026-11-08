import { useState } from 'react'
import { ChevronDown, HandCoins } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { useLoans } from '@/services/queries'
import type { Loan, LoanType } from '@/services/types'
import { formatDate, formatPeso } from '@/lib/format'
import { cn } from '@/lib/cn'

export const loanTypeLabels: Record<LoanType, string> = {
  sss: 'SSS Loan',
  pagibig: 'Pag-IBIG Loan',
  company: 'Company Loan',
  cash_advance: 'Cash Advance',
  other: 'Other Loan',
}

/** How much of the loan is paid, 0–100 (null when the amount borrowed isn't recorded) */
export function paidPercent(l: Pick<Loan, 'principal' | 'balance'>) {
  const p = Number(l.principal ?? 0)
  if (!p) return null
  return Math.min(100, Math.max(0, Math.round(((p - Number(l.balance ?? 0)) / p) * 100)))
}

/**
 * Loan ledger (checklist #37): every loan with its amount borrowed, balance and the payments deducted on released payslips.
 * Pass `employeeId` for one employee (employee page), or leave it out for everyone.
 */
export function LoanLedger({ employeeId, className }: { employeeId?: string; className?: string }) {
  const { data, isLoading } = useLoans(employeeId)
  const [open, setOpen] = useState<string | null>(null)

  if (isLoading) return <Skeleton className={cn('h-32', className)} />
  if (!data?.length)
    return (
      <Card className={cn('p-6', className)}>
        <EmptyState icon={HandCoins} title="No loans" description="Add one under Allowances & Deductions with the category “Loan”." />
      </Card>
    )

  return (
    <div className={cn('space-y-3', className)}>
      {data.map((l) => {
        const pct = paidPercent(l)
        const expanded = open === l.id
        return (
          <Card key={l.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : l.id)}
              aria-expanded={expanded}
              className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-5 text-left"
            >
              <span className="min-w-48 flex-1">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  {l.name}
                  <Badge size="sm" tone={l.active ? 'primary' : 'neutral'}>
                    {l.active ? l.typeLabel : 'Paid off / stopped'}
                  </Badge>
                </span>
                <span className="block text-xs text-muted">
                  {!employeeId && `${l.employeeName} · `}
                  {l.startDate ? `Since ${formatDate(l.startDate)}` : 'Start date not recorded'}
                </span>
              </span>
              <Stat label="Borrowed" value={l.principal ? formatPeso(l.principal) : '—'} />
              <Stat label="Per cut-off" value={formatPeso(l.amortization)} />
              <Stat label="Paid so far" value={formatPeso(l.totalPaid)} />
              <Stat label="Balance" value={l.balance ? formatPeso(l.balance) : '—'} strong />
              <ChevronDown className={cn('size-4 text-muted transition-transform', expanded && 'rotate-180')} />
              {pct !== null && (
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line" aria-label={`${pct}% paid`}>
                  <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                </span>
              )}
            </button>
            {expanded && (
              <div className="border-t border-line px-5 py-3">
                {l.payments.length ? (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1.5 text-left font-semibold">Payroll</th>
                        <th className="py-1.5 text-left font-semibold">Pay date</th>
                        <th className="py-1.5 text-right font-semibold">Deducted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {l.payments.map((p) => (
                        <tr key={p.periodId}>
                          <td className="py-2 text-ink">{p.period}</td>
                          <td className="py-2 text-ink">{formatDate(p.payDate)}</td>
                          <td className="py-2 text-right font-medium text-navy tabular-nums">{formatPeso(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-2 text-sm text-muted">No payments yet — they appear here once a payroll that deducts this loan is released.</p>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="text-right">
      <span className="block text-xs text-muted">{label}</span>
      <span className={cn('block tabular-nums', strong ? 'font-bold text-navy' : 'font-medium text-ink')}>{value}</span>
    </span>
  )
}
