import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

const tones = {
  primary: 'bg-primary-50 text-primary',
  success: 'bg-success-50 text-success',
  warning: 'bg-warning-50 text-warning',
  violet: 'bg-violet-50 text-violet',
  danger: 'bg-danger-50 text-danger',
}

export type Tone = keyof typeof tones

export function IconTile({ icon: Icon, tone = 'primary', className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full', tones[tone], className)}>
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  )
}
