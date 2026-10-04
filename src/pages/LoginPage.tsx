import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { api, isMockApi } from '@/services/api'
import { useAuth } from '@/store/auth'

const schema = z.object({
  email: z.email('Enter your work email'),
  password: z.string().min(6, 'At least 6 characters'),
})

type FormValues = z.infer<typeof schema>

type LoginState = { from?: string; passwordReset?: boolean } | null

export function LoginPage() {
  const session = useAuth((s) => s.session)
  const setSession = useAuth((s) => s.setSession)
  const navigate = useNavigate()
  const state = useLocation().state as LoginState
  const from = state?.from ?? '/app'

  const login = useMutation({
    mutationFn: (v: FormValues) => api.login(v.email, v.password),
    onSuccess: (s) => {
      setSession(s)
      navigate(from, { replace: true })
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isMockApi ? { email: 'hr@aznar.com', password: 'demo1234' } : undefined,
  })
  const email = watch('email')

  if (session) return <Navigate to="/app" replace />

  return (
    <AuthLayout title="Sign in to APAY" subtitle="For the HR department only.">
      {state?.passwordReset && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Your password was changed. Sign in with the new one.
        </p>
      )}
      <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4">
        <Field label="Work email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <Input type="email" autoComplete="username" autoFocus placeholder="you@aznar.com" className="pl-10" {...register('email')} />
          </div>
        </Field>
        <div>
          <Field label="Password" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="Enter your password" {...register('password')} />
          </Field>
          <div className="mt-1.5 flex justify-end">
            <Link to="/forgot-password" state={{ email }} className="text-sm font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {login.isError && <p className="text-sm font-medium text-danger">{login.error.message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      {isMockApi && (
        <p className="mt-6 rounded-xl bg-primary-50 p-3 text-center text-xs text-primary">
          Demo mode: any email and password works. In production only HR accounts can sign in.
        </p>
      )}
    </AuthLayout>
  )
}
