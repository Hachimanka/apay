import { Check } from 'lucide-react'
import type { PeriodStatus } from '@/services/types'
import { cn } from '@/lib/cn'

export const payrollSteps: { status: PeriodStatus; label: string; hint: string }[] = [
  { status: 'draft', label: 'Draft', hint: 'Collect attendance' },
  { status: 'computed', label: 'Compute', hint: 'Run the engine' },
  { status: 'review', label: 'Review', hint: 'Check every line' },
  { status: 'approved', label: 'Approve', hint: 'Finance sign-off' },
  { status: 'released', label: 'Release', hint: 'Publish to AZONE' },
]

export function PayrollStepper({ status, className }: { status: PeriodStatus; className?: string }) {
  const current = payrollSteps.findIndex((s) => s.status === status)
  return (
    <ol className={cn('grid grid-cols-5 gap-2', className)}>
      {payrollSteps.map((s, i) => {
        const done = i < current || status === 'released'
        const active = i === current && status !== 'released'
        return (
          <li key={s.status} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2', i <= current ? 'bg-primary' : 'bg-line')} />}
            <span
              className={cn(
                'relative flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition',
                done && 'border-primary bg-primary text-white',
                active && 'border-primary bg-surface text-primary ring-4 ring-primary-100',
                !done && !active && 'border-line bg-surface text-muted',
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn('mt-2 text-xs font-semibold', done || active ? 'text-navy' : 'text-muted')}>{s.label}</span>
            <span className="hidden text-[11px] text-muted sm:block">{s.hint}</span>
          </li>
        )
      })}
    </ol>
  )
}
