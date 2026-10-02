import { useState } from 'react'
import { Download, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { isIos, promptInstall, useInstall } from './install'

type InstallButtonProps = {
  className?: string
  variant?: 'primary' | 'outline' | 'soft' | 'white' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

/** Shows the native install prompt on Android/desktop Chrome, and instructions on iPhone. */
export function InstallButton({ className, variant = 'outline', size = 'sm', label = 'Install app' }: InstallButtonProps) {
  const { deferred, installed } = useInstall()
  const [iosHelp, setIosHelp] = useState(false)
  const ios = isIos()

  if (installed || (!deferred && !ios)) return null

  return (
    <>
      <Button variant={variant} size={size} className={cn(className)} onClick={() => (deferred ? promptInstall() : setIosHelp(true))}>
        <Download className="size-4" />
        {label}
      </Button>
      <Dialog
        open={iosHelp}
        onOpenChange={setIosHelp}
        title="Install APAY on your iPhone"
        description="Add APAY to your Home Screen to use it like an app."
      >
        <ol className="space-y-4 text-sm text-ink">
          <li className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary">
              <Share className="size-4" />
            </span>
            Tap the <b>Share</b> button in Safari’s toolbar.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary">
              <SquarePlus className="size-4" />
            </span>
            Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.
          </li>
        </ol>
        <Button className="mt-6 w-full" onClick={() => setIosHelp(false)}>
          Got it
        </Button>
      </Dialog>
    </>
  )
}
