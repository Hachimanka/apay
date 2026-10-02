import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

/** Registers the service worker and tells the user when a new version or offline mode is ready. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  const online = useOnline()

  if (!needRefresh && !offlineReady && online) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:bottom-6">
      <div className="card flex items-center gap-3 p-3.5 shadow-float">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
          {online ? <RefreshCw className="size-4" /> : <WifiOff className="size-4" />}
        </span>
        <p className="flex-1 text-sm font-medium text-navy">
          {!online
            ? 'You’re offline. Payroll data needs a connection.'
            : needRefresh
              ? 'A new version of APAY is available.'
              : 'APAY is ready to work offline.'}
        </p>
        {needRefresh && online ? (
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
        ) : (
          online && (
            <button
              className="rounded-full p-1.5 text-muted hover:bg-primary-50"
              aria-label="Dismiss"
              onClick={() => {
                setOfflineReady(false)
                setNeedRefresh(false)
              }}
            >
              <X className="size-4" />
            </button>
          )
        )}
      </div>
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
