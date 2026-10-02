import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ArrowLeft, Calculator, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { api, isMockApi } from '@/services/api'
import { useAuth } from '@/store/auth'
import { roleLabels } from '@/lib/permissions'
import type { Role } from '@/services/types'
import { cn } from '@/lib/cn'

const schema = z.object({
  email: z.email('Enter your work email'),
  password: z.string().min(6, 'At least 6 characters'),
  role: z.enum(['payroll_admin', 'hr', 'finance', 'management']),
})

type FormValues = z.infer<typeof schema>

const roleHints: Record<Role, string> = {
  payroll_admin: 'Compute & release',
  hr: 'People & time',
  finance: 'Approve & report',
  management: 'Approve & view',
}

export function LoginPage() {
  const session = useAuth((s) => s.session)
  const setSession = useAuth((s) => s.setSession)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app'

  const login = useMutation({
    mutationFn: (v: FormValues) => api.login(v.email, v.password, v.role),
    onSuccess: (s) => {
      setSession(s)
      navigate(from, { replace: true })
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isMockApi ? { email: 'payroll@aznar.com', password: 'demo1234', role: 'payroll_admin' } : { role: 'payroll_admin' },
  })
  const role = watch('role')

  if (session) return <Navigate to="/app" replace />

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy via-primary-700 to-primary p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" />
        <p className="text-3xl font-extrabold tracking-tight">AZNAR</p>
        <div className="relative mx-auto my-auto w-full max-w-lg">
          <h2 className="text-4xl leading-tight font-bold text-white">Payroll, computed right. Every cut-off.</h2>
          <p className="mt-4 text-white/80">Attendance in, payslips out — with SSS, PhilHealth, Pag-IBIG and BIR handled for you.</p>

          <div className="relative mt-14 px-6 pb-8">
            <motion.div
              className="card p-6 text-navy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <p className="flex items-center gap-2 font-bold">
                <Calculator className="size-5 text-primary" /> Payroll register
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-bg p-4">
                {[
                  ['Employees', '24'],
                  ['Gross', '₱587,240'],
                  ['Net pay', '₱492,815'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="mt-0.5 font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
            <motion.div
              className="card absolute -top-7 right-0 flex items-center gap-3 p-3 pr-5 text-navy shadow-float"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-success-50 text-success">
                <ShieldCheck className="size-4" />
              </span>
              <span>
                <span className="block text-[11px] text-muted">Approved by Finance</span>
                <span className="block text-sm font-bold">Ready to release</span>
              </span>
            </motion.div>
          </div>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} Aznar. Authorized personnel only.</p>
      </div>

      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <Logo to="/" />
          <h1 className="mt-10 text-3xl font-bold tracking-tight">Sign in to APAY</h1>
          <p className="mt-2 text-sm text-muted">For HR, Payroll, Finance and authorized management.</p>

          <form onSubmit={handleSubmit((v) => login.mutate(v))} className="mt-8 space-y-4">
            <Field label="Work email" error={errors.email?.message}>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                <Input type="email" autoComplete="username" className="pl-10" {...register('email')} />
              </div>
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                <Input type="password" autoComplete="current-password" className="pl-10" {...register('password')} />
              </div>
            </Field>

            {isMockApi && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold text-navy">Demo role</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setValue('role', r)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-left transition',
                        role === r ? 'border-primary bg-primary-50 ring-4 ring-primary-100' : 'border-line bg-white hover:border-primary-200',
                      )}
                    >
                      <span className="block text-sm font-semibold text-navy">{roleLabels[r]}</span>
                      <span className="block text-xs text-muted">{roleHints[r]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {login.isError && <p className="text-sm font-medium text-danger">{login.error.message}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          {isMockApi && (
            <p className="mt-6 rounded-xl bg-primary-50 p-3 text-center text-xs text-primary">
              Demo mode: any email and password works. In production the role comes from your Aznar account.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
