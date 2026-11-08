import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@/services/types'

type AuthState = {
  session: Session | null
  setSession: (session: Session) => void
  /** Access rights can change while signed in (HR edits them in Settings) */
  setPermissions: (permissions: NonNullable<Session['user']['permissions']>) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      setPermissions: (permissions) => set((s) => (s.session ? { session: { ...s.session, user: { ...s.session.user, permissions } } } : s)),
      logout: () => set({ session: null }),
    }),
    {
      name: 'apay-auth',
      // Non-HR sessions saved before access rights existed carry no permission list; drop them so they sign in again
      merge: (persisted, current) => {
        const saved = (persisted as Partial<AuthState> | undefined)?.session
        return { ...current, session: saved && (saved.user.role === 'hr' || Array.isArray(saved.user.permissions)) ? saved : null }
      },
    },
  ),
)
