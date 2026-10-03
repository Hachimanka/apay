import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconTile } from './IconTile'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-primary-50', className)} />
}

type PageHeaderProps = { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <IconTile icon={icon} className="size-14" />
      <p className="mt-4 font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    </div>
  )
}

export type Crumb = { label: ReactNode; to?: string }

/** Home icon, bold dark links, chevron separators; the last crumb is the current page and is highlighted. Same look as AZONE. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-2.5 text-[15px] font-bold">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="text-muted">
                  <ChevronRight className="size-4" strokeWidth={3} />
                </li>
              )}
              <li className="flex min-w-0 items-baseline gap-2">
                {i === 0 && <HomeIcon className="h-[15px] w-[17px] shrink-0 self-baseline text-primary" />}
                {last || !c.to ? (
                  <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'text-primary' : 'text-navy')}>
                    {c.label}
                  </span>
                ) : (
                  <Link to={c.to} className="truncate text-navy transition-colors hover:text-primary">
                    {c.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="1.8 3.2 20.4 17.8" fill="currentColor" aria-hidden className={className}>
      <path d="M12 3.2 1.8 12h2.7v8.3a.7.7 0 0 0 .7.7H10v-5.5h4V21h4.8a.7.7 0 0 0 .7-.7V12h2.7L18 8.4V4.5h-2.5v1.8z" />
    </svg>
  )
}
