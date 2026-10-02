import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide', {
  variants: {
    tone: {
      primary: 'bg-primary-50 text-primary',
      success: 'bg-success-50 text-success',
      warning: 'bg-warning-50 text-warning',
      danger: 'bg-danger-50 text-danger',
      violet: 'bg-violet-50 text-violet',
      neutral: 'bg-line text-muted',
    },
    size: {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-3 py-1 text-xs',
    },
  },
  defaultVariants: { tone: 'primary', size: 'md' },
})

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

type BadgeProps = VariantProps<typeof badgeVariants> & { children: ReactNode; className?: string }

export function Badge({ tone, size, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)}>{children}</span>
}
