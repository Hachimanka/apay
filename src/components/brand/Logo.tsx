import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type LogoProps = { to?: string; subtitle?: string; className?: string; stacked?: boolean }

export function Logo({ to = '/', subtitle = 'Payroll Platform', className, stacked }: LogoProps) {
  return (
    <Link to={to} className={cn('group inline-flex', stacked ? 'flex-col' : 'items-center gap-4', className)} aria-label="APAY home">
      <span className="text-[1.6rem] leading-none font-extrabold tracking-tight text-primary transition-colors group-hover:text-primary-600">
        AZNAR
      </span>
      {subtitle && <span className={cn('text-sm font-medium text-muted', stacked && 'mt-0.5 text-[11px]')}>{subtitle}</span>}
    </Link>
  )
}
