import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Check } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { api } from '@/services/api'
import { meetsPasswordRules, passwordRules } from '@/lib/passwordRules'
import { cn } from '@/lib/cn'

/** Step 2: opened from the emailed link (?token=…) to choose the new password. */
export function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const reset = useMutation({
    mutationFn: () => api.resetPassword(token, password),
    onSuccess: () => navigate('/login', { replace: true, state: { passwordReset: true } }),
  })

  const back = { to: '/login', label: 'Back to sign in' }

  if (!token)
    return (
      <AuthLayout title="Link not valid" subtitle="This page needs the link from your reset email." back={back}>
        <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
          Request a new reset link
        </Link>
      </AuthLayout>
    )

  const mismatch = touched && confirm !== password ? 'Passwords don’t match' : undefined
  const weak = touched && !meetsPasswordRules(password) ? 'Choose a password that meets every rule below' : undefined
  const expired = reset.isError && /invalid or has expired/i.test(reset.error.message)

  return (
    <AuthLayout title="Choose a new password" subtitle="You’ll use it the next time you sign in to APAY." back={back}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (meetsPasswordRules(password) && confirm === password) reset.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <Field label="New password" error={weak}>
            <PasswordInput
              autoComplete="new-password"
              autoFocus
              placeholder="Enter a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ul className="mt-2 space-y-0.5" aria-label="Password requirements">
            {passwordRules.map((r) => {
              const met = r.test(password)
              return (
                <li key={r.label} className={cn('flex items-center gap-1.5 text-xs font-medium', met ? 'text-success' : 'text-muted')}>
                  {met ? <Check className="size-3.5" /> : <span className="inline-block size-3.5 text-center">•</span>}
                  {r.label}
                </li>
              )
            })}
          </ul>
        </div>
        <Field label="Confirm new password" error={mismatch}>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        {reset.isError && (
          <p className="flex gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {reset.error.message}{' '}
              {expired && (
                <Link to="/forgot-password" className="underline">
                  Send a new link
                </Link>
              )}
            </span>
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
