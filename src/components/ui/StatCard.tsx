import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconTile, type Tone } from './IconTile'

type StatCardProps = {
  icon: LucideIcon
  tone?: Tone
  label: string
  value: ReactNode
  hint: string
  to: string
  className?: string
}

export function StatCard({ icon, tone, label, value, hint, to, className }: StatCardProps) {
  return (
    <Link to={to} className={cn('card card-hover group block p-4 sm:p-5', className)}>
      <IconTile icon={icon} tone={tone} className="size-9 sm:size-11" />
      <p className="mt-3 text-xs font-medium text-muted sm:mt-4 sm:text-sm">{label}</p>
      <div className="mt-1 text-xl font-bold tracking-tight text-navy sm:text-[1.7rem]">{value}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted sm:text-xs">
        <span className="truncate">{hint}</span>
        <ChevronRight className="hover-arrow size-4 shrink-0 transition-transform duration-200" />
      </div>
    </Link>
  )
}
