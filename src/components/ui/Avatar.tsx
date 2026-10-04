import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

/** A person's photo, or their initials when there's no photo (or while it loads). */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-400 to-primary text-sm font-bold text-white ring-4 ring-primary-50',
        className,
      )}
      aria-hidden
    >
      {src ? <img src={src} alt="" draggable={false} className="size-full object-cover" /> : initials(name)}
    </span>
  )
}
