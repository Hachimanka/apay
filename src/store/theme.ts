import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

type ThemeState = {
  theme: Theme
  toggle: () => void
}

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

/** Starts from the OS preference; once the user flips the toggle, their choice is remembered. */
export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: prefersDark() ? 'dark' : 'light',
      toggle: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'apay-theme' },
  ),
)
