import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  History,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Menu,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { buttonVariants } from '@/components/ui/Button'
import { InstallButton } from '@/components/pwa/InstallButton'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'
import { Reveal, SectionHeading } from './Reveal'
import { DesktopMockup } from './Mockups'
import { ContactForm } from './ContactForm'

const navLinks = [
  { href: '#overview', label: 'Overview' },
  { href: '#lifecycle', label: 'Payroll Cycle' },
  { href: '#compliance', label: 'Compliance' },
  { href: '#security', label: 'Security' },
  { href: '#contact', label: 'Contact' },
]

export function LandingPage() {
  return (
    <div className="overflow-x-clip bg-white">
      <Navbar />
      <Hero />
      <ComplianceStrip />
      <Overview />
      <Lifecycle />
      <StatsBand />
      <Compliance />
      <Security />
      <Contact />
      <Footer />
    </div>
  )
}

/* ---------------------------------- Navbar --------------------------------- */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const signedIn = useAuth((s) => !!s.session)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'safe-top fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || open ? 'border-b border-line bg-white/90 shadow-card backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <ul className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="relative rounded-lg px-3.5 py-2 text-sm font-medium text-ink transition after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform hover:text-primary hover:after:scale-x-100"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <InstallButton variant="ghost" />
          {!signedIn && (
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Sign in
            </Link>
          )}
          <Link to={signedIn ? '/app' : '/login'} className={buttonVariants({ size: 'sm' })}>
            {signedIn ? 'Open APAY' : 'Go to APAY'} <ArrowRight className="size-4" />
          </Link>
        </div>
        <button className="rounded-lg p-2 text-navy lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-line bg-white px-4 pt-2 pb-6 lg:hidden">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 font-medium text-ink hover:bg-primary-50 hover:text-primary"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-3 grid gap-2">
            <InstallButton variant="soft" size="md" />
            <Link to={signedIn ? '/app' : '/login'} className={buttonVariants({ className: 'w-full' })}>
              {signedIn ? 'Open APAY' : 'Sign in to APAY'}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

/* ----------------------------------- Hero ---------------------------------- */

function Hero() {
  const benefits = [
    'Statutory deductions computed to the centavo',
    'Four-step approval before any peso is released',
    'Payslips published straight to employees’ AZONE',
  ]

  return (
    <section className="relative pt-32 pb-24 sm:pt-40 lg:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,#dbe6fc_0%,transparent_70%),radial-gradient(40%_40%_at_0%_30%,#eef3fd_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(#e6ecf7_1px,transparent_1px),linear-gradient(90deg,#e6ecf7_1px,transparent_1px)] mask-[radial-gradient(70%_60%_at_50%_0%,black,transparent)] bg-size-[44px_44px] opacity-50" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-card"
          >
            <Lock className="size-3.5" /> For HR, Payroll, Finance & Management
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Payroll, computed right.{' '}
            <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">Every cut-off.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted"
          >
            APAY is the Aznar payroll platform. Turn attendance into accurate payslips — with overtime, leaves, loans, SSS, PhilHealth, Pag-IBIG and
            BIR tax handled in one controlled workflow.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/login" className={buttonVariants({ size: 'lg' })}>
              Sign in to APAY <ArrowRight className="size-4" />
            </Link>
            <a href="#lifecycle" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              See the payroll cycle
            </a>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-8 space-y-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm font-medium text-ink">
                <CheckCircle2 className="size-5 text-primary" /> {b}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <DesktopMockup />
          <div className="animate-float card absolute -top-6 -left-6 hidden items-center gap-3 p-3 pr-5 sm:flex">
            <span className="flex size-9 items-center justify-center rounded-full bg-success-50 text-success">
              <ShieldCheck className="size-5" />
            </span>
            <span>
              <span className="block text-[11px] text-muted">Approved by Finance</span>
              <span className="block text-sm font-bold text-navy">₱492,815 net payroll</span>
            </span>
          </div>
          <div className="animate-float-slow card absolute -right-4 -bottom-8 hidden items-center gap-3 p-3 pr-5 [animation-delay:1.5s] sm:flex">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary">
              <Landmark className="size-5" />
            </span>
            <span>
              <span className="block text-[11px] text-muted">Gov’t remittance ready</span>
              <span className="block text-sm font-bold text-navy">SSS · PhilHealth · Pag-IBIG · BIR</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ----------------------------- Compliance strip ----------------------------- */

const agencies = [
  'SSS contributions',
  'PhilHealth premiums',
  'Pag-IBIG savings',
  'BIR withholding tax',
  'BIR 1604-C alphalist',
  '13th month pay',
  'Holiday & rest-day pay',
  'Overtime premiums',
  'Loan amortization',
  'Bank payroll file',
]

function ComplianceStrip() {
  return (
    <section className="border-y border-line bg-bg py-10">
      <p className="text-center text-sm font-semibold text-muted">Built for Philippine payroll rules</p>
      <div className="relative mt-6 overflow-hidden mask-[linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-4 hover:[animation-play-state:paused]">
          {[...agencies, ...agencies].map((t, i) => (
            <span
              key={i}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-ink shadow-card transition hover:border-primary-200 hover:text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Overview --------------------------------- */

function Overview() {
  return (
    <section id="overview" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="One controlled platform"
          title="Replace spreadsheets with a payroll you can trust"
          description="Every number traces back to attendance, a rate table or an approved adjustment — and every action is logged."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <article className="card card-hover group h-full overflow-hidden">
              <div className="p-8">
                <span className="text-xs font-bold tracking-wider text-primary uppercase">For Payroll & HR</span>
                <h3 className="mt-2 text-2xl font-bold">Compute a full cut-off in minutes</h3>
                <p className="mt-3 text-muted">
                  Attendance, overtime, leaves, allowances and loans flow into one payroll register you can review line by line.
                </p>
              </div>
              <div className="relative h-60 overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 px-8 pt-8">
                <DesktopMockup className="origin-top-left transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-[1.02]" />
              </div>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="card card-hover group h-full overflow-hidden">
              <div className="p-8">
                <span className="text-xs font-bold tracking-wider text-primary uppercase">For Finance & Management</span>
                <h3 className="mt-2 text-2xl font-bold">Approve with full visibility</h3>
                <p className="mt-3 text-muted">
                  See totals, government remittances and changes before you sign off. Nothing is released without approval.
                </p>
              </div>
              <div className="flex h-60 flex-col justify-center gap-3 bg-gradient-to-br from-primary-50 to-primary-100 px-8">
                {[
                  { icon: Calculator, t: 'Payroll computed · 24 employees', s: 'Done', tone: 'text-success bg-success-50' },
                  { icon: FileCheck2, t: 'Submitted for review', s: 'Done', tone: 'text-success bg-success-50' },
                  { icon: ShieldCheck, t: 'Finance approval', s: 'Pending', tone: 'text-warning bg-warning-50' },
                ].map(({ icon: Icon, t, s, tone }, i) => (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card transition-transform duration-300 group-hover:translate-x-2"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-navy">{t}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase', tone)}>{s}</span>
                  </div>
                ))}
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- Lifecycle -------------------------------- */

const lifecycle = [
  {
    icon: Clock,
    tag: 'Collect',
    title: 'Attendance & DTR',
    text: 'Time records from AZONE and biometrics, summarised per cut-off with lates, absences and overtime.',
  },
  {
    icon: Calculator,
    tag: 'Compute',
    title: 'Payroll engine',
    text: 'Basic pay, overtime premiums, allowances and unpaid leave — computed with exact decimal math.',
  },
  {
    icon: Landmark,
    tag: 'Deduct',
    title: 'Government & loans',
    text: 'SSS, PhilHealth, Pag-IBIG, BIR tax, plus loans and other deductions applied automatically.',
  },
  {
    icon: FileCheck2,
    tag: 'Review',
    title: 'Payroll register',
    text: 'Inspect every employee line, preview payslips and export the register before submitting.',
  },
  {
    icon: ShieldCheck,
    tag: 'Approve',
    title: 'Finance sign-off',
    text: 'Finance or management approves. Approved payroll is locked and can’t be recomputed.',
  },
  {
    icon: Send,
    tag: 'Release',
    title: 'Payslips & bank file',
    text: 'Payslips publish to AZONE and the bank file and remittance reports are ready.',
  },
]

function Lifecycle() {
  return (
    <section id="lifecycle" className="scroll-mt-20 bg-bg py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Payroll cycle"
          title="One cut-off. Six controlled steps."
          description="The same reliable process every 15th and end of month."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map(({ icon: Icon, tag, title, text }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <article className="card card-hover group relative h-full overflow-hidden p-7">
                <span className="absolute top-5 right-6 text-5xl font-extrabold text-primary-50 transition-colors duration-300 group-hover:text-primary-100">
                  0{i + 1}
                </span>
                <span className="relative flex size-13 items-center justify-center rounded-2xl bg-primary-50 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-lift">
                  <Icon className="size-6" />
                </span>
                <p className="relative mt-6 text-xs font-bold tracking-wider text-primary uppercase">{tag}</p>
                <h3 className="relative mt-1 text-xl font-bold">{title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{text}</p>
                <span className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary-400 transition-transform duration-300 group-hover:scale-x-100" />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- Stats band -------------------------------- */

function StatsBand() {
  const stats = [
    { value: '₱0.00', label: 'Rounding errors' },
    { value: '4-step', label: 'Approval workflow' },
    { value: '100%', label: 'Actions audit-logged' },
    { value: '2×', label: 'Cut-offs a month' },
  ]
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-primary-700 to-primary px-8 py-14 text-white sm:px-14">
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-white/5" />
        <div className="relative grid grid-cols-2 gap-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm font-medium text-white/75">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

/* -------------------------------- Compliance -------------------------------- */

function Compliance() {
  const items = [
    { title: 'SSS', text: 'Monthly salary credit brackets with employee and employer shares.' },
    { title: 'PhilHealth', text: 'Premium on basic salary within the floor and ceiling, shared 50/50.' },
    { title: 'Pag-IBIG', text: 'Employee and employer savings capped at the maximum fund salary.' },
    { title: 'BIR', text: 'TRAIN withholding tax table, net of contributions and de minimis.' },
  ]
  return (
    <section id="compliance" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Compliance"
          title="Government deductions, handled"
          description="Rate tables live in one place, are versioned per year and apply to every employee consistently."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.06}>
              <div className="card card-hover h-full p-6">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-navy text-sm font-extrabold text-white">
                  {it.title.slice(0, 3).toUpperCase()}
                </span>
                <p className="mt-5 text-lg font-bold text-navy">{it.title}</p>
                <p className="mt-1 text-sm text-muted">{it.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div className="card card-hover p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-navy text-white">
                <Calculator className="size-6" />
              </span>
              <h3 className="mt-5 text-2xl font-bold">APAY</h3>
              <p className="text-sm font-semibold text-primary">Payroll Platform</p>
              <p className="mt-3 text-sm text-muted">Where HR and Payroll compute, approve and release.</p>
            </div>
            <div className="flex flex-col items-center gap-3 py-2 lg:px-4">
              <div className="relative flex size-24 items-center justify-center rounded-full bg-primary-50">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary-100 opacity-60 [animation-duration:2.5s]" />
                <span className="relative flex size-16 flex-col items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary shadow-lift">
                  <Lock className="size-5" />
                  API
                </span>
              </div>
              <p className="max-w-[10rem] text-center text-xs font-medium text-muted">Released payslips & announcements sync to AZONE</p>
            </div>
            <div className="card card-hover p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white">
                <UserRound className="size-6" />
              </span>
              <h3 className="mt-5 text-2xl font-bold">AZONE</h3>
              <p className="text-sm font-semibold text-primary">Employee Platform</p>
              <p className="mt-3 text-sm text-muted">Where employees see their payslips, DTR and leave balances.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------- Security --------------------------------- */

function Security() {
  const points = [
    { icon: KeyRound, title: 'Role-based access', text: 'Payroll Admin, HR, Finance and Management each see only what they need.' },
    { icon: ShieldCheck, title: 'Maker–checker approval', text: 'The person who computes payroll is never the one who approves it.' },
    { icon: History, title: 'Full audit trail', text: 'Every computation, approval, release and setting change is recorded.' },
    { icon: Lock, title: 'Separate from AZONE', text: 'Employees never touch payroll data — they only receive their own payslip.' },
  ]
  return (
    <section id="security" className="scroll-mt-20 bg-bg py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <SectionHeading
            center={false}
            eyebrow="Security"
            title="Built for sensitive financial data"
            description="APAY is a separate application with its own access rules, so payroll stays in the hands of authorized people."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {points.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <div className="card card-hover h-full p-5">
                  <Icon className="size-6 text-primary" />
                  <p className="mt-3 font-bold text-navy">{title}</p>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.1}>
          <div className="card p-6">
            <p className="flex items-center gap-2 font-bold text-navy">
              <Users className="size-5 text-primary" /> Who can do what
            </p>
            <table className="mt-5 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 text-left font-semibold">Action</th>
                  {['Payroll', 'HR', 'Finance', 'Mgmt'].map((r) => (
                    <th key={r} className="py-2 text-center font-semibold">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ['Manage employees', [1, 1, 0, 0]],
                  ['Compute payroll', [1, 0, 0, 0]],
                  ['Approve payroll', [0, 0, 1, 1]],
                  ['Release payroll', [1, 0, 1, 0]],
                  ['View reports', [1, 1, 1, 1]],
                ].map(([label, flags]) => (
                  <tr key={label as string}>
                    <td className="py-2.5 text-ink">{label as string}</td>
                    {(flags as number[]).map((f, i) => (
                      <td key={i} className="py-2.5 text-center">
                        {f ? <BadgeCheck className="mx-auto size-4 text-success" /> : <span className="text-line">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------- Contact --------------------------------- */

function Contact() {
  return (
    <section id="contact" className="scroll-mt-20 py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8">
        <div>
          <SectionHeading
            center={false}
            eyebrow="Get in touch"
            title="Need access or a walkthrough?"
            description="Request APAY access for your team or ask the payroll team a question."
          />
          <Reveal className="mt-10 space-y-4">
            {[
              { icon: Mail, label: 'Email', value: 'payroll@aznar.com' },
              { icon: Phone, label: 'Payroll team', value: '(032) 555 0100 · local 135' },
              { icon: MapPin, label: 'Head Office', value: 'Cebu Business Park, Cebu City' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-xs text-muted">{label}</span>
                  <span className="block font-semibold text-navy">{value}</span>
                </span>
              </div>
            ))}
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <ContactForm />
        </Reveal>
      </div>
    </section>
  )
}

/* ---------------------------------- Footer ---------------------------------- */

function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <p className="text-2xl font-extrabold">AZNAR</p>
          <p className="mt-1 text-sm text-white/60">Payroll Platform</p>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            APAY runs payroll operations for Aznar — from attendance to released payslips. Authorized personnel only.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Platform</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            <li>
              <Link to="/login" className="transition hover:text-white">
                Sign in to APAY
              </Link>
            </li>
            <li>
              <a href="https://azone.aznar.com" className="inline-flex items-center gap-1 transition hover:text-white">
                <FileText className="size-3.5" /> AZONE (Employees)
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Aznar. All rights reserved.</p>
          <a href="#" className="transition hover:text-white">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  )
}
