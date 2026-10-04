import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { isMockApi } from '@/services/api'
import { useAuth } from '@/store/auth'

/** An AZONE "Forgot password?" request waiting for HR (aznar-api: /apay/password-resets). */
type ResetRequest = { id: string; name: string; email: string; employeeNo: string; department: string; requestedAt: string }
type Issued = { email: string; temporaryPassword: string }

/*
 * Self-contained client for the reset queue. Kept in this file (rather than services/httpApi.ts) while the
 * APAY email-reset work is in flight in those service files; fold it into services/ once that lands.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

async function call<T>(path: string, method = 'GET'): Promise<T> {
  const token = useAuth.getState().session?.token
  const res = await fetch(`${BASE}/apay/password-resets${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? '{}' : undefined,
  })
  if (res.status === 401) useAuth.getState().logout()
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText)
  return res.status === 204 ? (undefined as T) : res.json()
}

// Demo mode: one sample request so the panel can be seen without the API
let demoQueue: ResetRequest[] = [
  {
    id: 'demo-reset-1',
    name: 'Leonard Forrosuelo',
    email: 'leonard.forrosuelo@aznar.com',
    employeeNo: 'AZN-2021-0148',
    department: 'IT Department',
    requestedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
]
const demo = {
  list: async () => demoQueue,
  resolve: async (id: string): Promise<Issued> => {
    const r = demoQueue.find((q) => q.id === id)!
    demoQueue = demoQueue.filter((q) => q.id !== id)
    return { email: r.email, temporaryPassword: 'Demo7kPq2xWm' }
  },
  dismiss: async (id: string) => {
    demoQueue = demoQueue.filter((q) => q.id !== id)
  },
}
const resets = isMockApi
  ? demo
  : {
      list: () => call<ResetRequest[]>(''),
      resolve: (id: string) => call<Issued>(`/${id}/resolve`, 'POST'),
      dismiss: (id: string) => call<void>(`/${id}/dismiss`, 'POST'),
    }

const KEY = ['password-resets']

/** HR's queue of AZONE password reset requests. Renders nothing when the queue is empty. */
export function PasswordResetRequests() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: KEY, queryFn: resets.list, refetchInterval: 60_000 })
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: KEY })

  const resolve = useMutation({
    mutationFn: resets.resolve,
    onSuccess: (r) => {
      setCopied(false)
      setIssued(r)
      refresh()
    },
  })
  const dismiss = useMutation({ mutationFn: resets.dismiss, onSuccess: refresh })
  const error = resolve.error ?? dismiss.error

  if (data.length === 0 && !issued) return null

  return (
    <>
      {data.length > 0 && (
        <Card className="mb-5 border-warning/40 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning-50 text-warning">
              <KeyRound className="size-5" />
            </span>
            <div>
              <p className="font-bold text-navy">Password reset {data.length === 1 ? 'request' : `requests (${data.length})`}</p>
              <p className="text-sm text-muted">
                Employees who used "Forgot password?" in AZONE. Issue a temporary password and give it to them directly.
              </p>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {data.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[r.employeeNo, r.department, r.email].filter(Boolean).join(' · ')} · requested{' '}
                    {formatDistanceToNowStrict(new Date(r.requestedAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(r.id)} disabled={dismiss.isPending || resolve.isPending}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={() => resolve.mutate(r.id)} disabled={dismiss.isPending || resolve.isPending}>
                    Issue temporary password
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm font-medium text-danger">{error.message}</p>}
        </Card>
      )}

      <Dialog
        open={!!issued}
        onOpenChange={(o) => !o && setIssued(null)}
        title="Temporary password issued"
        description={issued ? `For ${issued.email}. Their old password no longer works.` : undefined}
      >
        {issued && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg p-4">
              <code className="font-mono text-xl font-bold tracking-wider text-navy select-all">{issued.temporaryPassword}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(issued.temporaryPassword)
                  setCopied(true)
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted">
              This is shown <b>only once</b>. Give it to the employee in person or by phone. Don't send it in a group chat.
            </p>
            <Button className="mt-5 w-full" onClick={() => setIssued(null)}>
              Done
            </Button>
          </>
        )}
      </Dialog>
    </>
  )
}
