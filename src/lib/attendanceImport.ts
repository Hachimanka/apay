import type { AttendanceInput, AttendanceRow } from '@/services/types'
import { parseCsv } from './csv'

/** Columns of the downloadable template; uploads match headers loosely (case, spaces and punctuation ignored). */
export const templateHeaders = {
  employeeNo: 'Employee No',
  name: 'Name',
  workingDays: 'Working days',
  daysPresent: 'Present',
  absentDays: 'Absent',
  lateMinutes: 'Late (min)',
  paidLeaveDays: 'Paid leave',
  unpaidLeaveDays: 'Unpaid leave',
} as const

const aliases: Record<string, keyof typeof templateHeaders> = {
  employeeno: 'employeeNo',
  employeeid: 'employeeNo',
  empno: 'employeeNo',
  idno: 'employeeNo',
  present: 'daysPresent',
  dayspresent: 'daysPresent',
  absent: 'absentDays',
  absences: 'absentDays',
  absentdays: 'absentDays',
  late: 'lateMinutes',
  latemin: 'lateMinutes',
  lateminutes: 'lateMinutes',
  tardiness: 'lateMinutes',
  paidleave: 'paidLeaveDays',
  paidleavedays: 'paidLeaveDays',
  unpaidleave: 'unpaidLeaveDays',
  unpaidleavedays: 'unpaidLeaveDays',
  lwop: 'unpaidLeaveDays',
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '')

export function attendanceTemplate(rows: AttendanceRow[]) {
  return rows.map((r) => ({
    [templateHeaders.employeeNo]: r.employeeNo,
    [templateHeaders.name]: r.name,
    [templateHeaders.workingDays]: r.workingDays,
    [templateHeaders.daysPresent]: r.daysPresent,
    [templateHeaders.absentDays]: r.absentDays,
    [templateHeaders.lateMinutes]: r.lateMinutes,
    [templateHeaders.paidLeaveDays]: r.paidLeaveDays,
    [templateHeaders.unpaidLeaveDays]: r.unpaidLeaveDays,
  }))
}

export type ImportResult = {
  /** Valid rows that differ from what's on file */
  changes: { input: AttendanceInput; before: AttendanceRow }[]
  unchanged: number
  errors: string[]
}

/**
 * Read an uploaded cut-off sheet against the current roster. Rows are matched by Employee No.
 * Late and leave columns may be omitted (treated as 0); a blank Present is filled in from the working days.
 */
export function readAttendanceCsv(text: string, current: AttendanceRow[]): ImportResult {
  const [header, ...body] = parseCsv(text)
  if (!header) return { changes: [], unchanged: 0, errors: ['The file is empty.'] }
  const col = new Map<keyof typeof templateHeaders, number>()
  header.forEach((h, i) => {
    const key = aliases[norm(h)]
    if (key && !col.has(key)) col.set(key, i)
  })
  if (!col.has('employeeNo')) return { changes: [], unchanged: 0, errors: ['Missing an "Employee No" column — start from the template.'] }
  if (!col.has('absentDays')) return { changes: [], unchanged: 0, errors: ['Missing an "Absent" column — start from the template.'] }

  const byNo = new Map(current.map((r) => [r.employeeNo.trim().toUpperCase(), r]))
  const seen = new Set<string>()
  const result: ImportResult = { changes: [], unchanged: 0, errors: [] }

  body.forEach((cells, i) => {
    const line = i + 2
    const cell = (k: keyof typeof templateHeaders) => (col.has(k) ? (cells[col.get(k)!] ?? '').trim() : '')
    const no = cell('employeeNo').toUpperCase()
    const before = byNo.get(no)
    if (!before) return void result.errors.push(`Row ${line}: no active employee with Employee No "${cell('employeeNo')}"`)
    if (seen.has(no)) return void result.errors.push(`Row ${line}: ${before.name} appears more than once`)
    seen.add(no)

    const num = (k: keyof typeof templateHeaders, step: number) => {
      const raw = cell(k)
      if (raw === '') return 0
      const v = Number(raw)
      return Number.isFinite(v) && v >= 0 && Number.isInteger(v / step) ? v : NaN
    }
    const absentDays = num('absentDays', 0.5)
    const paidLeaveDays = num('paidLeaveDays', 0.5)
    const unpaidLeaveDays = num('unpaidLeaveDays', 0.5)
    const lateMinutes = num('lateMinutes', 1)
    const daysPresent = cell('daysPresent') === '' ? before.workingDays - absentDays - paidLeaveDays - unpaidLeaveDays : num('daysPresent', 0.5)

    if ([absentDays, paidLeaveDays, unpaidLeaveDays, daysPresent].some(Number.isNaN))
      return void result.errors.push(`Row ${line} (${before.name}): days must be whole or half numbers, 0 or more`)
    if (Number.isNaN(lateMinutes)) return void result.errors.push(`Row ${line} (${before.name}): late minutes must be a whole number`)
    if (daysPresent + absentDays + paidLeaveDays + unpaidLeaveDays !== before.workingDays)
      return void result.errors.push(`Row ${line} (${before.name}): present + absent + leave must equal ${before.workingDays} working days`)

    const input: AttendanceInput = { employeeId: before.employeeId, daysPresent, absentDays, lateMinutes, paidLeaveDays, unpaidLeaveDays }
    const same =
      before.daysPresent === daysPresent &&
      before.absentDays === absentDays &&
      before.lateMinutes === lateMinutes &&
      before.paidLeaveDays === paidLeaveDays &&
      before.unpaidLeaveDays === unpaidLeaveDays
    if (same) result.unchanged++
    else result.changes.push({ input, before })
  })
  return result
}
