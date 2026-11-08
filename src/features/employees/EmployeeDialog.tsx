import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useSaveEmployee, useShifts } from '@/services/queries'
import { shiftSummary } from '@/features/settings/ShiftCodes'
import type { EmployeeProfile } from '@/services/types'
import { formatDate } from '@/lib/format'
import {
  departments,
  employeeEditSchema,
  employmentTypes,
  parseSkills,
  taxStatusLabels,
  taxStatusOptions,
  type EmployeeEditValues,
} from './employeeForm'
import { civilStatusLabels, genderLabels, payBasisLabels } from './records'

/** Edit an existing employee's master data and HRIS profile. (New employees are added on their own page, which also creates the AZONE account.) */
export function EmployeeDialog({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const save = useSaveEmployee()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeEditValues>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: {
      ...employee,
      middleName: employee.middleName ?? '',
      level: employee.level ?? '',
      payBasis: employee.payBasis ?? 'monthly',
      gender: employee.gender ?? '',
      civilStatus: employee.civilStatus ?? '',
      birthday: employee.birthday ?? '',
      address: employee.address ?? '',
      permanentAddress: employee.permanentAddress ?? '',
      spouseName: employee.spouseName ?? '',
      skills: (employee.skills ?? []).join(', '),
      shiftId: employee.shiftId ?? '',
    },
  })
  const shifts = useShifts()
  // Active shifts, plus the current one even if it was since made inactive
  const shiftOptions = (shifts.data ?? []).filter((s) => s.active || s.id === employee.shiftId)

  const onSubmit = handleSubmit(async (v) => {
    await save.mutateAsync({
      ...v,
      id: employee.id,
      monthlyBasic: Number(v.monthlyBasic).toFixed(2),
      skills: parseSkills(v.skills),
      shiftId: v.shiftId || null,
      bank: employee.bank,
      govIds: employee.govIds,
    })
    onClose()
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit ${employee.fullName}`} description={`Hired ${formatDate(employee.hireDate)}`}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Heading>Personal information</Heading>
        <Field label="First name" error={errors.firstName?.message}>
          <Input {...register('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
        <Field label="Middle name" error={errors.middleName?.message}>
          <Input {...register('middleName')} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" {...register('birthday')} />
        </Field>
        <Field label="Gender">
          <Select {...register('gender')}>
            <option value="">—</option>
            {Object.entries(genderLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Civil status">
          <Select {...register('civilStatus')}>
            <option value="">—</option>
            {Object.entries(civilStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Wide>
          <Field label="Spouse's name" error={errors.spouseName?.message}>
            <Input {...register('spouseName')} />
          </Field>
        </Wide>
        <Wide>
          <Field label="Present address" error={errors.address?.message}>
            <Textarea className="min-h-16" {...register('address')} />
          </Field>
        </Wide>
        <Wide>
          <Field label="Permanent address" error={errors.permanentAddress?.message}>
            <Textarea className="min-h-16" {...register('permanentAddress')} />
          </Field>
        </Wide>
        <Wide>
          <Field label="Skills (comma-separated)" error={errors.skills?.message}>
            <Input placeholder="e.g. Excel, Forklift operation, Welding" {...register('skills')} />
          </Field>
        </Wide>

        <Heading>Employment</Heading>
        <Field label="Employee No." error={errors.employeeNo?.message}>
          <Input {...register('employeeNo')} />
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Position title" error={errors.position?.message}>
          <Input {...register('position')} />
        </Field>
        <Field label="Department">
          <Select {...register('department')}>
            {[...new Set([...departments, employee.department])].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Level" error={errors.level?.message}>
          <Input placeholder="e.g. Rank & File, Supervisor" {...register('level')} />
        </Field>
        <Field label="Employment type">
          <Select {...register('employmentType')}>
            {employmentTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select {...register('status')}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="resigned">Resigned</option>
          </Select>
        </Field>
        <Field label="Hire date" error={errors.hireDate?.message}>
          <Input type="date" {...register('hireDate')} />
        </Field>
        <Wide>
          <Field label="Shift">
            <Select {...register('shiftId')} disabled={!shifts.data}>
              <option value="">Company default (Mon–Fri)</option>
              {shiftOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name} — {shiftSummary(s)}
                </option>
              ))}
            </Select>
          </Field>
        </Wide>

        <Heading>Compensation</Heading>
        <Field label="Monthly basic (₱)" error={errors.monthlyBasic?.message}>
          <Input inputMode="decimal" {...register('monthlyBasic')} />
        </Field>
        <Field label="Pay basis">
          <Select {...register('payBasis')}>
            {Object.entries(payBasisLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tax status">
          <Select {...register('taxStatus')}>
            {taxStatusOptions(employee.taxStatus).map((t) => (
              <option key={t} value={t}>
                {taxStatusLabels[t]}
              </option>
            ))}
          </Select>
        </Field>

        <p className="col-span-2 text-xs text-muted">Changes to position, department, level, type, status or rate are added to the movement history.</p>
        <div className="col-span-2 mt-1">
          {save.isError && <p className="mb-2 text-sm text-danger">{save.error.message}</p>}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

const Heading = ({ children }: { children: ReactNode }) => (
  <p className="col-span-2 mt-2 border-b border-line pb-1 text-xs font-bold tracking-wide text-muted uppercase first:mt-0">{children}</p>
)
const Wide = ({ children }: { children: ReactNode }) => <div className="col-span-2">{children}</div>
