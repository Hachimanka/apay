import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Copy,
  Landmark,
  Lock,
  Smartphone,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { useCreateEmployee, useEmployees } from '@/services/queries'
import type { NewEmployeeResult } from '@/services/types'
import { useDetailCrumb } from '@/store/breadcrumb'
import { dailyRate } from '@/lib/payroll'
import { formatPeso } from '@/lib/format'
import {
  departments,
  employeeSchema,
  employmentTypes,
  newEmployeeDefaults,
  nextEmployeeNo,
  taxStatusLabels,
  taxStatusOptions,
  type EmployeeFormValues,
} from '@/features/employees/employeeForm'

type Extras = { bankName: string; bankAccount: string; sss: string; philhealth: string; pagibig: string; tin: string }
const noExtras: Extras = { bankName: '', bankAccount: '', sss: '', philhealth: '', pagibig: '', tin: '' }

/** Add an employee to the payroll master and create their AZONE login in the same step. */
export function AddEmployeePage() {
  useDetailCrumb('Add employee')
  const create = useCreateEmployee()
  const [created, setCreated] = useState<NewEmployeeResult | null>(null)
  const [extras, setExtras] = useState<Extras>(noExtras)
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormValues>({ resolver: zodResolver(employeeSchema), defaultValues: newEmployeeDefaults() })

  // Employee No. is always the next in the company sequence (with the hire year); HR can't type over it
  const employees = useEmployees()
  const hireDate = watch('hireDate')
  const employeeNo = watch('employeeNo')
  const suggested = employees.data
    ? nextEmployeeNo(
        employees.data.map((e) => e.employeeNo),
        hireDate,
      )
    : null
  useEffect(() => {
    if (suggested) setValue('employeeNo', suggested, { shouldValidate: !!errors.employeeNo })
  }, [suggested, setValue, errors.employeeNo])

  const basic = watch('monthlyBasic')
  const email = watch('email')
  const validBasic = /^\d+(\.\d{1,2})?$/.test(basic ?? '') && Number(basic) > 0

  const onSubmit = handleSubmit(async (v) => {
    const result = await create.mutateAsync({
      ...v,
      email: v.email.trim().toLowerCase(),
      monthlyBasic: Number(v.monthlyBasic).toFixed(2),
      bank: { name: extras.bankName.trim(), account: extras.bankAccount.trim() },
      govIds: { sss: extras.sss.trim(), philhealth: extras.philhealth.trim(), pagibig: extras.pagibig.trim(), tin: extras.tin.trim() },
    })
    setCreated(result)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  if (created)
    return (
      <Created
        result={created}
        onAddAnother={() => {
          setCreated(null)
          setExtras(noExtras)
          reset({ ...newEmployeeDefaults(), employeeNo: suggested ?? '' })
          create.reset()
        }}
      />
    )

  const extra = (key: keyof Extras, label: string, placeholder: string) => (
    <Field label={label}>
      <Input placeholder={placeholder} value={extras[key]} onChange={(e) => setExtras((x) => ({ ...x, [key]: e.target.value }))} />
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">People</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Add employee</h1>
          <p className="mt-1.5 text-sm text-muted">Adds them to payroll and creates their AZONE account in one step.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section icon={UserRound} title="Personal details">
            <Field label="First name" error={errors.firstName?.message}>
              <Input autoFocus placeholder="e.g. Liza" {...register('firstName')} />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input placeholder="e.g. Morales" {...register('lastName')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Work email (their AZONE sign-in)" error={errors.email?.message}>
                <Input type="email" autoComplete="off" placeholder="firstname.lastname@aznar.com" {...register('email')} />
              </Field>
            </div>
          </Section>

          <Section icon={BriefcaseBusiness} title="Employment">
            {/* Shown, not an input: it can't be typed in, focused or clicked */}
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-navy">Employee No.</span>
              <div
                aria-label="Employee No. (assigned automatically)"
                className="flex w-full cursor-default items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm font-semibold text-navy tabular-nums select-none"
              >
                {employeeNo || <span className="font-normal text-muted">Assigning…</span>}
                <Lock className="size-4 shrink-0 text-muted" />
              </div>
              <p className="mt-1 text-xs text-muted">Assigned automatically — next in sequence.</p>
              {errors.employeeNo && !employeeNo && (
                <p className="mt-1 text-xs font-medium text-danger">Still loading the next number — try again in a moment.</p>
              )}
            </div>
            <Field label="Position" error={errors.position?.message}>
              <Input placeholder="e.g. Accounting Clerk" {...register('position')} />
            </Field>
            <Field label="Department">
              <Select {...register('department')}>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Employment type">
              <Select {...register('employmentType')}>
                {employmentTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Hire date" error={errors.hireDate?.message}>
              <Input type="date" {...register('hireDate')} />
            </Field>
            <Field label="Status">
              <Select {...register('status')}>
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
              </Select>
            </Field>
          </Section>

          <Section icon={Banknote} title="Pay">
            <Field label="Monthly basic (₱)" error={errors.monthlyBasic?.message}>
              <Input inputMode="decimal" placeholder="e.g. 22000" {...register('monthlyBasic')} />
            </Field>
            <Field label="Tax status">
              <Select {...register('taxStatus')}>
                {taxStatusOptions().map((t) => (
                  <option key={t} value={t}>
                    {taxStatusLabels[t]}
                  </option>
                ))}
              </Select>
            </Field>
            {validBasic && (
              <p className="text-sm text-muted sm:col-span-2">
                Daily rate <b className="text-navy">{formatPeso(dailyRate(basic).toFixed(2))}</b> · semi-monthly basic{' '}
                <b className="text-navy">{formatPeso((Number(basic) / 2).toFixed(2))}</b>
              </p>
            )}
          </Section>

          <Section icon={Landmark} title="Bank & government IDs" hint="Optional — you can add these later from the employee’s page.">
            {extra('bankName', 'Bank', 'e.g. BDO')}
            {extra('bankAccount', 'Account no.', 'e.g. 0012 3456 7890')}
            {extra('sss', 'SSS', '00-0000000-0')}
            {extra('philhealth', 'PhilHealth', '00-000000000-0')}
            {extra('pagibig', 'Pag-IBIG', '0000-0000-0000')}
            {extra('tin', 'TIN', '000-000-000-000')}
          </Section>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <Card className="p-5 sm:p-6">
            <CardHeader icon={Smartphone} title="AZONE account" />
            <p className="mt-3 text-sm text-muted">Saving also creates their AZONE login, so they can see payslips, file leaves and time in.</p>
            <dl className="mt-4 space-y-2 rounded-xl bg-bg p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Sign-in</dt>
                <dd className="truncate font-semibold text-navy">{email?.trim() || 'their work email'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Password</dt>
                <dd className="font-semibold text-navy">Temporary, shown once</dd>
              </div>
            </dl>
            {create.isError && (
              <p className="mt-4 flex gap-2 rounded-xl bg-danger-50 px-3.5 py-3 text-sm font-medium text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {create.error.message}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={create.isPending}>
              <UserPlus className="size-4" /> {create.isPending ? 'Adding…' : 'Add employee & create account'}
            </Button>
            <Link to="/app/employees" className="mt-3 block text-center text-sm font-semibold text-muted hover:text-primary">
              Cancel
            </Link>
          </Card>
        </div>
      </div>
    </form>
  )
}

function Section({ icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={icon} title={title} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

/** After saving: the AZONE login details, shown once for HR to hand over. */
function Created({ result, onAddAnother }: { result: NewEmployeeResult; onAddAnother: () => void }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const { employee, account } = result
  const details = `AZONE sign-in for ${employee.fullName}\nEmail: ${account.email}\nTemporary password: ${account.temporaryPassword}\nYou'll be asked to choose your own password the first time you sign in.`

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
      <Card className="p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{employee.fullName} was added</h1>
        <p className="mt-1.5 text-sm text-muted">
          {employee.employeeNo} · {employee.position} · {employee.department}. Their AZONE account is ready.
        </p>

        <dl className="mt-6 space-y-3 rounded-2xl border border-line bg-bg p-5 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">AZONE sign-in</dt>
            <dd className="truncate font-semibold text-navy">{account.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Temporary password</dt>
            <dd className="rounded-lg bg-surface px-3 py-1.5 font-mono text-base font-bold tracking-wider text-navy ring-1 ring-line select-all">
              {account.temporaryPassword}
            </dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-2 text-left text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          This password is shown only once. Give it to {employee.firstName} now (in person or a private message) — it can’t be seen again.
        </p>
        <p className="mt-2 text-left text-xs text-muted">
          The first time {employee.firstName} signs in to AZONE, they’ll be asked to replace it with a password of their own.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(details)
              setCopied(true)
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy details'}
          </Button>
          <Button variant="soft" onClick={onAddAnother}>
            <UserPlus className="size-4" /> Add another
          </Button>
          <Button onClick={() => navigate(`/app/employees/${employee.id}`)}>View employee</Button>
        </div>
      </Card>
    </motion.div>
  )
}
