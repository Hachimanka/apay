import { differenceInCalendarDays, parseISO } from 'date-fns'
import { formatDate, formatPeso } from '@/lib/format'
import type { Employee, EmployeeRecordKind, RecordValue } from '@/services/types'
import type { BadgeTone } from '@/components/ui/Badge'

/**
 * The 201-file record kinds: what each holds and how it reads in a list.
 * Mirrors aznar-api src/services/employeeRecords.ts (the API is the authority on validation).
 */

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'date' | 'year' | 'number' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
  /** Full width in the form */
  wide?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export type RecordSummary = { title: string; subtitle?: string; meta?: string; badge?: { label: string; tone: BadgeTone } }

export type RecordConfig = {
  kind: EmployeeRecordKind
  title: string
  singular: string
  empty: string
  fields: FieldDef[]
  summary: (d: Record<string, RecordValue>) => RecordSummary
  /** Field used to sort newest first */
  sortBy?: string
}

const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }))

export const genderLabels = { male: 'Male', female: 'Female' } as const
export const civilStatusLabels = { single: 'Single', married: 'Married', widowed: 'Widowed', separated: 'Separated', annulled: 'Annulled' } as const
export const payBasisLabels = { monthly: 'Monthly-paid', daily: 'Daily-paid' } as const

export const educationLevels = {
  high_school: 'High school',
  senior_high: 'Senior high school',
  vocational: 'Vocational / technical',
  college: 'College',
  post_graduate: 'Post-graduate',
}
export const medicalResults = { fit: 'Fit to work', fit_with_restrictions: 'Fit with restrictions', unfit: 'Unfit', pending: 'Pending' }
export const disciplinaryActions = {
  verbal_warning: 'Verbal warning',
  written_warning: 'Written warning',
  final_warning: 'Final warning',
  suspension: 'Suspension',
  termination: 'Termination',
  other: 'Other',
}
export const movementTypes = {
  hire: 'Hired',
  promotion: 'Promotion',
  position_change: 'Position change',
  transfer: 'Transfer',
  salary_adjustment: 'Salary adjustment',
  status_change: 'Status change',
  separation: 'Separation',
  other: 'Other',
}

const s = (v: RecordValue | undefined) => (v === null || v === undefined ? '' : String(v))
const d = (v: RecordValue | undefined) => (s(v) ? formatDate(s(v)) : '')
const range = (a: RecordValue | undefined, b: RecordValue | undefined, openEnd = 'present') =>
  s(a) || s(b) ? `${d(a) || '?'} – ${d(b) || openEnd}` : ''
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

/** Days until a license expires (negative = expired), or null when there's no expiry date. */
export function daysToExpiry(expiryDate: RecordValue | undefined, today = new Date()) {
  return s(expiryDate) ? differenceInCalendarDays(parseISO(s(expiryDate)), today) : null
}

export function expiryBadge(expiryDate: RecordValue | undefined): RecordSummary['badge'] {
  const days = daysToExpiry(expiryDate)
  if (days === null) return undefined
  if (days < 0) return { label: 'Expired', tone: 'danger' }
  if (days <= 90) return { label: `Expires in ${days}d`, tone: 'warning' }
  return { label: 'Valid', tone: 'success' }
}

const remarks: FieldDef = { key: 'remarks', label: 'Remarks', type: 'textarea', wide: true }

export const recordConfigs: Record<EmployeeRecordKind, RecordConfig> = {
  child: {
    kind: 'child',
    title: 'Children',
    singular: 'child',
    empty: 'No children recorded.',
    sortBy: 'birthDate',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, wide: true },
      { key: 'birthDate', label: 'Date of birth', type: 'date' },
      { key: 'gender', label: 'Gender', type: 'select', options: [{ value: '', label: '—' }, ...opts(genderLabels)] },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.name),
      subtitle: join(x.birthDate ? `Born ${d(x.birthDate)}` : '', genderLabels[s(x.gender) as keyof typeof genderLabels]),
    }),
  },
  education: {
    kind: 'education',
    title: 'Educational background',
    singular: 'education',
    empty: 'No education recorded.',
    sortBy: 'yearGraduated',
    fields: [
      { key: 'level', label: 'Level', type: 'select', required: true, options: opts(educationLevels) },
      { key: 'yearGraduated', label: 'Year graduated', type: 'year', placeholder: 'e.g. 2015' },
      { key: 'school', label: 'School', type: 'text', required: true, wide: true },
      { key: 'course', label: 'Course / strand', type: 'text', wide: true },
      { key: 'honors', label: 'Honors / awards', type: 'text', wide: true },
    ],
    summary: (x) => ({
      title: s(x.school),
      subtitle: join(educationLevels[s(x.level) as keyof typeof educationLevels], s(x.course), s(x.honors)),
      meta: s(x.yearGraduated) ? `Class of ${s(x.yearGraduated)}` : undefined,
    }),
  },
  employment_history: {
    kind: 'employment_history',
    title: 'Previous employers',
    singular: 'previous employer',
    empty: 'No previous employment recorded.',
    sortBy: 'startDate',
    fields: [
      { key: 'employer', label: 'Employer', type: 'text', required: true, wide: true },
      { key: 'position', label: 'Position', type: 'text', wide: true },
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
      { key: 'reasonForLeaving', label: 'Reason for leaving', type: 'textarea', wide: true },
    ],
    summary: (x) => ({ title: s(x.employer), subtitle: s(x.position), meta: range(x.startDate, x.endDate, '?') }),
  },
  training: {
    kind: 'training',
    title: 'Workshops, seminars & trainings',
    singular: 'training',
    empty: 'No trainings recorded.',
    sortBy: 'startDate',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, wide: true },
      { key: 'provider', label: 'Provider / venue', type: 'text', wide: true },
      { key: 'startDate', label: 'Start', type: 'date' },
      { key: 'endDate', label: 'End', type: 'date' },
      { key: 'hours', label: 'Hours', type: 'number', min: 0, max: 10000, step: 0.5 },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.title),
      subtitle: join(s(x.provider), x.hours !== null && x.hours !== undefined && x.hours !== '' ? `${x.hours} hrs` : ''),
      meta: range(x.startDate, x.endDate, d(x.startDate) ? '' : '?').replace(/ – $/, ''),
    }),
  },
  certification: {
    kind: 'certification',
    title: 'Certifications & licenses',
    singular: 'certification / license',
    empty: 'No certifications or licenses recorded.',
    sortBy: 'expiryDate',
    fields: [
      { key: 'name', label: 'Certificate / license', type: 'text', required: true, wide: true, placeholder: 'e.g. PRC License, STCW Basic Safety' },
      { key: 'number', label: 'Number', type: 'text' },
      { key: 'issuedBy', label: 'Issued by', type: 'text' },
      { key: 'issueDate', label: 'Issued', type: 'date' },
      { key: 'expiryDate', label: 'Expires', type: 'date' },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.name),
      subtitle: join(s(x.number) && `No. ${s(x.number)}`, s(x.issuedBy)),
      meta: x.expiryDate ? `Expires ${d(x.expiryDate)}` : x.issueDate ? `Issued ${d(x.issueDate)}` : 'No expiry',
      badge: expiryBadge(x.expiryDate),
    }),
  },
  medical: {
    kind: 'medical',
    title: 'Medical examinations',
    singular: 'medical result',
    empty: 'No medical results recorded.',
    sortBy: 'examDate',
    fields: [
      { key: 'examDate', label: 'Exam date', type: 'date', required: true },
      { key: 'type', label: 'Type', type: 'text', required: true, placeholder: 'Pre-employment, Annual, PEME…' },
      { key: 'result', label: 'Result', type: 'select', required: true, options: opts(medicalResults) },
      { key: 'clinic', label: 'Clinic', type: 'text' },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.type),
      subtitle: s(x.clinic),
      meta: d(x.examDate),
      badge: {
        label: medicalResults[s(x.result) as keyof typeof medicalResults] ?? s(x.result),
        tone: x.result === 'fit' ? 'success' : x.result === 'unfit' ? 'danger' : x.result === 'pending' ? 'neutral' : 'warning',
      },
    }),
  },
  appraisal: {
    kind: 'appraisal',
    title: 'Performance appraisals',
    singular: 'appraisal',
    empty: 'No appraisals recorded.',
    sortBy: 'reviewDate',
    fields: [
      { key: 'period', label: 'Review period', type: 'text', required: true, placeholder: 'e.g. 2026 H1' },
      { key: 'reviewDate', label: 'Review date', type: 'date' },
      { key: 'rating', label: 'Rating (1–5)', type: 'number', min: 1, max: 5, step: 0.1 },
      { key: 'reviewer', label: 'Reviewer', type: 'text' },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.period),
      subtitle: join(s(x.reviewer) && `by ${s(x.reviewer)}`, s(x.remarks)),
      meta: d(x.reviewDate),
      badge:
        x.rating === null || x.rating === undefined || x.rating === ''
          ? undefined
          : { label: `${Number(x.rating).toFixed(1)} / 5`, tone: Number(x.rating) >= 4 ? 'success' : Number(x.rating) >= 3 ? 'primary' : 'warning' },
    }),
  },
  disciplinary: {
    kind: 'disciplinary',
    title: 'Disciplinary actions',
    singular: 'disciplinary action',
    empty: 'No disciplinary actions recorded.',
    sortBy: 'date',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'action', label: 'Action', type: 'select', required: true, options: opts(disciplinaryActions) },
      { key: 'offense', label: 'Offense / violation', type: 'textarea', required: true, wide: true },
      { key: 'suspensionDays', label: 'Suspension days', type: 'number', min: 0, max: 365, step: 1 },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.offense),
      subtitle: x.suspensionDays ? `${x.suspensionDays} day suspension` : s(x.remarks),
      meta: d(x.date),
      badge: {
        label: disciplinaryActions[s(x.action) as keyof typeof disciplinaryActions] ?? s(x.action),
        tone: x.action === 'termination' || x.action === 'suspension' ? 'danger' : 'warning',
      },
    }),
  },
  asset: {
    kind: 'asset',
    title: 'Assigned assets',
    singular: 'asset',
    empty: 'No assets assigned.',
    sortBy: 'dateIssued',
    fields: [
      { key: 'name', label: 'Item', type: 'text', required: true, wide: true, placeholder: 'e.g. Laptop, Mobile phone, ID, PPE' },
      { key: 'assetTag', label: 'Asset tag', type: 'text' },
      { key: 'serialNo', label: 'Serial no.', type: 'text' },
      { key: 'dateIssued', label: 'Issued', type: 'date' },
      { key: 'dateReturned', label: 'Returned', type: 'date' },
      { key: 'condition', label: 'Condition', type: 'text' },
      remarks,
    ],
    summary: (x) => ({
      title: s(x.name),
      subtitle: join(s(x.assetTag) && `Tag ${s(x.assetTag)}`, s(x.serialNo) && `S/N ${s(x.serialNo)}`, s(x.condition)),
      meta: x.dateIssued ? `Issued ${d(x.dateIssued)}` : undefined,
      badge: x.dateReturned ? { label: 'Returned', tone: 'neutral' } : { label: 'With employee', tone: 'primary' },
    }),
  },
  movement: {
    kind: 'movement',
    title: 'Employee movement',
    singular: 'movement',
    empty: 'No movement recorded yet. Changes to position, department, level, rate or status are logged here automatically.',
    sortBy: 'effectiveDate',
    fields: [
      { key: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
      { key: 'type', label: 'Type', type: 'select', required: true, options: opts(movementTypes).filter((o) => o.value !== 'hire') },
      { key: 'details', label: 'Details', type: 'textarea', required: true, wide: true, placeholder: 'e.g. Position: Clerk → Senior Clerk' },
      remarks,
    ],
    summary: (x) => ({
      title: movementTypes[s(x.type) as keyof typeof movementTypes] ?? s(x.type),
      subtitle: join(s(x.details), s(x.remarks)),
      meta: d(x.effectiveDate),
      badge: x.type === 'separation' ? { label: 'Separation', tone: 'danger' } : undefined,
    }),
  },
}

/** Empty form values for a record kind. */
export function blankRecord(kind: EmployeeRecordKind): Record<string, RecordValue> {
  return Object.fromEntries(
    recordConfigs[kind].fields.map((f) => [f.key, f.type === 'number' ? null : f.type === 'select' && f.required ? f.options![0].value : '']),
  )
}

/** Client-side check before saving; the API validates again. Returns field → message. */
export function validateRecord(kind: EmployeeRecordKind, data: Record<string, RecordValue>) {
  const errors: Record<string, string> = {}
  for (const f of recordConfigs[kind].fields) {
    const v = data[f.key]
    const empty = v === null || v === undefined || String(v).trim() === ''
    if (f.required && empty) errors[f.key] = 'Required'
    else if (!empty && f.type === 'year' && !/^\d{4}$/.test(String(v))) errors[f.key] = 'Use a 4-digit year'
    else if (!empty && f.type === 'number') {
      const n = Number(v)
      if (Number.isNaN(n)) errors[f.key] = 'Enter a number'
      else if (f.min !== undefined && n < f.min) errors[f.key] = `At least ${f.min}`
      else if (f.max !== undefined && n > f.max) errors[f.key] = `At most ${f.max}`
    }
  }
  return errors
}

/** Newest first by the kind's main date (records without it go last). */
export function sortRecords<T extends { kind: EmployeeRecordKind; data: Record<string, RecordValue>; createdAt: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const key = recordConfigs[a.kind].sortBy
    const av = key ? s(a.data[key]) : ''
    const bv = key ? s(b.data[key]) : ''
    if (av !== bv) return av ? (bv ? bv.localeCompare(av) : -1) : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

/* ------------------------- Movement history (mock API) ------------------------- */

type Tracked = Pick<Employee, 'position' | 'department' | 'employmentType' | 'status' | 'monthlyBasic'> & Pick<Employee, 'payBasis' | 'level'>
const trackedLabels: Record<keyof Tracked, string> = {
  position: 'Position',
  department: 'Department',
  level: 'Level',
  employmentType: 'Employment type',
  payBasis: 'Pay basis',
  status: 'Status',
  monthlyBasic: 'Monthly basic',
}

/** Same rule as the API: the entry for an employee update, or null when nothing tracked changed. */
export function movementFor(before: Tracked, after: Tracked) {
  const norm = (f: keyof Tracked, v: unknown) => (f === 'monthlyBasic' ? Number(v ?? 0).toFixed(2) : f === 'payBasis' ? String(v || 'monthly') : String(v ?? ''))
  const changed = (Object.keys(trackedLabels) as (keyof Tracked)[]).filter((f) => norm(f, before[f]) !== norm(f, after[f]))
  if (!changed.length) return null
  const has = (f: keyof Tracked) => changed.includes(f)
  const type =
    has('status') && after.status === 'resigned'
      ? 'separation'
      : has('department')
        ? 'transfer'
        : has('position') || has('level')
          ? 'position_change'
          : has('monthlyBasic')
            ? 'salary_adjustment'
            : 'status_change'
  const show = (f: keyof Tracked, v: unknown) => (f === 'monthlyBasic' ? formatPeso(norm(f, v)) : norm(f, v) || '—')
  return { type, details: changed.map((f) => `${trackedLabels[f]}: ${show(f, before[f])} → ${show(f, after[f])}`).join('; ') }
}
