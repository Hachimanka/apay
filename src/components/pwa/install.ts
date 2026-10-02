import { create } from 'zustand'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = {
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const useInstall = create<InstallState>(() => ({ deferred: null, installed: isStandalone() }))

// Chrome/Android fire this early, before React mounts — capture it at module load.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  useInstall.setState({ deferred: e as BeforeInstallPromptEvent })
})
window.addEventListener('appinstalled', () => useInstall.setState({ deferred: null, installed: true }))

export async function promptInstall() {
  const { deferred } = useInstall.getState()
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  useInstall.setState({ deferred: null })
  return outcome === 'accepted'
}
