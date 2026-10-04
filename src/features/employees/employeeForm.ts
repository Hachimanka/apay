import { z } from 'zod'
import { manilaToday } from '@/lib/timeRecords'

/** Shared by the Add employee page and the Edit employee dialog. */
export const departments = ['IT Department', 'HR Department', 'Finance', 'Operations', 'Sales & Marketing', 'Customer Service']
export const employmentTypes = ['Regular', 'Probationary', 'Contractual'] as const
export const taxStatuses = ['S', 'ME', 'S1', 'ME1', 'ME2'] as const
export type TaxStatus = (typeof taxStatuses)[number]

/** Plain-language names. Under the TRAIN law withholding tax no longer depends on status or dependents, so new
 * employees just pick Single or Married; the dependent codes only remain on older records. */
export const taxStatusLabels: Record<TaxStatus, string> = {
  S: 'Single',
  ME: 'Married',
  S1: 'Single, 1 dependent',
  ME1: 'Married, 1 dependent',
  ME2: 'Married, 2 dependents',
}

/** Options for a dropdown: Single and Married, plus the record's current value if it is an older dependent code. */
export const taxStatusOptions = (current?: TaxStatus): TaxStatus[] =>
  current && current !== 'S' && current !== 'ME' ? ['S', 'ME', current] : ['S', 'ME']

export const employeeSchema = z.object({
  employeeNo: z.string().trim().min(3, 'Required'),
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  email: z.email('Enter a valid work email'),
  position: z.string().trim().min(2, 'Required'),
  department: z.string().min(1),
  employmentType: z.enum(employmentTypes),
  status: z.enum(['active', 'on_leave', 'resigned']),
  monthlyBasic: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount like 25000 or 25000.50'),
  hireDate: z.string().min(1, 'Required'),
  taxStatus: z.enum(taxStatuses),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export const newEmployeeDefaults = (): Partial<EmployeeFormValues> => ({
  employeeNo: '', // filled with the next number in sequence once the employee list loads
  department: departments[0],
  employmentType: 'Probationary',
  status: 'active',
  taxStatus: 'S',
  hireDate: manilaToday(),
})

const employeeNoPattern = /^AZN-(\d{4})-(\d+)$/i

/**
 * Next Employee No. in Aznar's sequence: AZN-<hire year>-<number>, where the number counts up company-wide
 * (AZN-2026-0262 follows AZN-2022-0261). HR can still type a different one; the API refuses duplicates.
 */
export function nextEmployeeNo(existing: string[], hireDate: string) {
  const highest = existing.reduce((max, no) => {
    const m = no.trim().match(employeeNoPattern)
    return m ? Math.max(max, Number(m[2])) : max
  }, 0)
  const year = /^\d{4}/.test(hireDate) ? hireDate.slice(0, 4) : String(new Date().getFullYear())
  return `AZN-${year}-${String(highest + 1).padStart(4, '0')}`
}
