import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Calculator, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

/** Sign-in, forgot-password and reset-password pages: brand panel on the left (desktop), the form on the right. */
export function AuthLayout({
  title,
  subtitle,
  back = { to: '/', label: 'Back to home' },
  children,
}: {
  title: string
  subtitle: ReactNode
  back?: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to={back.to} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <Logo to="/" />
          <h1 className="mt-10 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
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
              <span className="block text-[11px] text-muted">Approved by HR</span>
              <span className="block text-sm font-bold">Ready to release</span>
            </span>
          </motion.div>
        </div>
      </div>
      <p className="relative text-sm text-white/60">© {new Date().getFullYear()} Aznar. Authorized personnel only.</p>
    </div>
  )
}
