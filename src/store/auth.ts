import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@/services/types'

type AuthState = {
  session: Session | null
  setSession: (session: Session) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
    }),
    { name: 'apay-auth' },
  ),
)
