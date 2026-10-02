import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary text-sm font-bold text-white ring-4 ring-primary-50',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
