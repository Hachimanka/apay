import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Mail, MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { api } from '@/services/api'

const RESEND_COOLDOWN_S = 60
const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/** Step 1 of "Forgot password?": email a one-time reset link. Reads the same whether or not the account exists. */
export function ForgotPasswordPage() {
  const initial = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const send = useMutation({
    mutationFn: (target: string) => api.requestPasswordReset(target),
    onSuccess: (_, target) => {
      setSentTo(target)
      setCooldown(RESEND_COOLDOWN_S)
    },
  })

  const back = { to: '/login', label: 'Back to sign in' }

  if (sentTo)
    return (
      <AuthLayout title="Check your email" subtitle="Use the link we sent to choose a new password." back={back}>
        <div className="flex gap-3 rounded-2xl bg-success-50 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <p className="text-sm text-ink">
            If <b className="break-all text-navy">{sentTo}</b> belongs to an APAY account, a reset link is on its way. It works once and expires in 30
            minutes.
          </p>
        </div>
        <p className="mt-4 text-xs text-muted">Nothing after a few minutes? Check your spam folder, or resend it.</p>
        {send.isError && <p className="mt-3 text-sm font-medium text-danger">{send.error.message}</p>}
        <Button className="mt-5 w-full" size="lg" variant="outline" disabled={send.isPending || cooldown > 0} onClick={() => send.mutate(sentTo)}>
          {send.isPending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
        </Button>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    )

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your work email and we’ll send you a link to choose a new password." back={back}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const target = email.trim()
          if (!validEmail(target)) return setError('Enter your work email, like name@aznar.com.')
          setError(null)
          send.mutate(target)
        }}
        className="space-y-4"
      >
        <Field label="Work email" error={error ?? undefined}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@aznar.com"
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Field>
        {send.isError && <p className="text-sm font-medium text-danger">{send.error.message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
