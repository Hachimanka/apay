import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />
}

type CardHeaderProps = {
  icon?: LucideIcon
  title: ReactNode
  action?: ReactNode
  viewAllTo?: string
  className?: string
}

export function CardHeader({ icon: Icon, title, action, viewAllTo, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2.5 text-base font-bold text-navy">
        {Icon && <Icon className="size-5 text-primary" strokeWidth={2.2} />}
        {title}
      </h2>
      {action}
      {viewAllTo && (
        <Link to={viewAllTo} className="group inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-600">
          View All
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
