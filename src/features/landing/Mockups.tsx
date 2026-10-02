import { BadgePercent, CalendarRange, ChartColumn, Clock, FileText, Landmark, LayoutDashboard, Users, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/* Static, scaled-down replica of the APAY payroll screen used as a product shot. */

const steps = ['Draft', 'Compute', 'Review', 'Approve', 'Release']
const rows = [
  ['Leonard Forrosuelo', '₱27,000', '₱4,084', '₱22,916'],
  ['Maria Santos', '₱48,500', '₱9,861', '₱38,639'],
  ['Mark Bautista', '₱23,500', '₱3,697', '₱19,803'],
  ['Kristine Villanueva', '₱20,000', '₱2,446', '₱17,554'],
  ['Paolo Garcia', '₱17,000', '₱2,212', '₱14,788'],
]

export function DesktopMockup({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-white shadow-float', className)}>
      <div className="flex items-center gap-1.5 border-b border-line bg-bg px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-4 rounded-md bg-white px-3 py-0.5 text-[10px] text-muted">apay.aznar.com</span>
      </div>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="flex items-center gap-3">
          <span className="text-base font-extrabold text-primary">AZNAR</span>
          <span className="text-[10px] text-muted">Payroll Platform</span>
        </span>
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">KV</span>
      </div>
      <div className="flex">
        <div className="hidden w-32 shrink-0 space-y-1 border-r border-line p-3 sm:block">
          {[LayoutDashboard, Users, Clock, CalendarRange, FileText, BadgePercent, Landmark, ChartColumn].map((Icon, i) => (
            <div key={i} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', i === 3 ? 'bg-primary text-white' : 'text-ink')}>
              <Icon className="size-3" />
              <span className="h-1.5 w-12 rounded-full bg-current opacity-30" />
            </div>
          ))}
        </div>
        <div className="flex-1 bg-bg p-4">
          <p className="text-[8px] font-semibold tracking-wider text-muted uppercase">Payroll period</p>
          <p className="flex items-center gap-2 text-sm font-bold text-navy">
            Oct 1 – 15, 2026 <span className="rounded-full bg-warning-50 px-1.5 text-[7px] font-bold text-warning uppercase">For review</span>
          </p>
          <div className="mt-3 grid grid-cols-5 rounded-lg border border-line bg-white p-2.5">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[7px] font-bold',
                    i < 2 ? 'bg-primary text-white' : i === 2 ? 'border border-primary bg-white text-primary' : 'border border-line text-muted',
                  )}
                >
                  {i < 2 ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="text-[7px] text-navy">{s}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[
              ['Employees', '24'],
              ['Gross', '₱587,240'],
              ['Deductions', '₱94,425'],
              ['Net pay', '₱492,815'],
            ].map(([l, v], i) => (
              <div key={l} className={cn('rounded-lg border border-line bg-white p-2', i === 3 && 'border-primary-200 bg-primary-50')}>
                <p className="text-[7px] text-muted">{l}</p>
                <p className={cn('text-[10px] font-bold', i === 3 ? 'text-primary' : 'text-navy')}>{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line bg-white">
            <div className="grid grid-cols-4 bg-bg px-2.5 py-1.5 text-[7px] font-semibold text-muted">
              <span>Employee</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Deductions</span>
              <span className="text-right">Net</span>
            </div>
            {rows.map((r) => (
              <div key={r[0]} className="grid grid-cols-4 border-t border-line px-2.5 py-1.5 text-[7.5px]">
                <span className="font-semibold text-navy">{r[0]}</span>
                <span className="text-right text-ink">{r[1]}</span>
                <span className="text-right text-ink">{r[2]}</span>
                <span className="text-right font-bold text-navy">{r[3]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
