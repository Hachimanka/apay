import type { ReactNode } from 'react'
import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

/** Bottom sheet on phones, centered modal on desktop. */
export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm" />
        <RD.Content className="safe-bottom fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-float sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RD.Title className="text-lg font-bold text-navy">{title}</RD.Title>
              <RD.Description className={description ? 'mt-1 text-sm text-muted' : 'sr-only'}>{description ?? title}</RD.Description>
            </div>
            <RD.Close className="rounded-full p-1.5 text-muted hover:bg-primary-50 hover:text-primary" aria-label="Close">
              <X className="size-5" />
            </RD.Close>
          </div>
          {children}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
