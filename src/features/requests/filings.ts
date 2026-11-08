import type { AzoneRequest, FilingKind } from '@/services/types'
import { formatDate } from '@/lib/format'

/** Time filings (checklist #73–77) that change the time records; overtime is listed with the other overtime. */
export const timeFilingKinds = ['dtr_discrepancy', 'no_dtr', 'undertime', 'official_business'] as const
export type TimeFilingKind = (typeof timeFilingKinds)[number]
export const isTimeFiling = (kind: string): kind is TimeFilingKind => (timeFilingKinds as readonly string[]).includes(kind)

export const filingLabels: Record<FilingKind, string> = {
  dtr_discrepancy: 'DTR Discrepancy',
  no_dtr: 'No DTR',
  undertime: 'Undertime',
  official_business: 'Official Business',
  overtime: 'Overtime',
}

/** What approving does, shown in the inbox and the filing form */
export const filingEffect: Record<FilingKind, string> = {
  dtr_discrepancy: 'Approving replaces that day’s time record with these times. The old times stay in the audit trail.',
  no_dtr: 'Approving creates the time record for that day.',
  undertime: 'Undertime is always deducted (no work, no pay). Approving records it as excused.',
  official_business: 'Approving counts each workday in the range as present, with no absence, late or undertime.',
  overtime: 'Approving pays these hours (beyond 8 that day) at the rate of that date.',
}

type Data = Record<string, unknown>
const s = (v: unknown) => (typeof v === 'string' ? v : '')
const range = (a: string, b: string) => (a === b ? formatDate(a) : `${formatDate(a, 'MMM d')} – ${formatDate(b)}`)
const times = (d: Data) => {
  const brk = d.breakOut && d.breakIn ? ` · break ${s(d.breakOut)}–${s(d.breakIn)}` : ''
  return `${s(d.timeIn)}–${s(d.timeOut)}${brk}`
}

/** One-line summary of a structured filing; null when it's free text (older AZONE builds). */
export function filingSummary(r: Pick<AzoneRequest, 'kind' | 'data'>): string | null {
  const d = r.data
  if (!d) return null
  switch (r.kind) {
    case 'dtr_discrepancy':
    case 'no_dtr':
      return `${formatDate(s(d.date))} · ${times(d)}`
    case 'undertime':
      return `${formatDate(s(d.date))} · left at ${s(d.timeOut)}`
    case 'official_business': {
      const hours = d.timeFrom && d.timeTo ? ` · ${s(d.timeFrom)}–${s(d.timeTo)}` : ' · whole day'
      return `${range(s(d.startDate), s(d.endDate))}${hours} · ${s(d.location)}`
    }
    case 'overtime':
      return d.date && d.hours ? `${formatDate(s(d.date))} · ${String(d.hours)} h` : null
    default:
      return null
  }
}

/** Label/value pairs for the request dialog */
export function filingFacts(r: Pick<AzoneRequest, 'kind' | 'data'>): [string, string][] {
  const d = r.data
  if (!d) return []
  switch (r.kind) {
    case 'dtr_discrepancy':
    case 'no_dtr':
      return [
        ['Date', formatDate(s(d.date))],
        ['Time in / out', `${s(d.timeIn)} – ${s(d.timeOut)}`],
        ['Break', d.breakOut && d.breakIn ? `${s(d.breakOut)} – ${s(d.breakIn)}` : 'Standard 1 hour'],
      ]
    case 'undertime':
      return [
        ['Date', formatDate(s(d.date))],
        ['Left at', s(d.timeOut)],
      ]
    case 'official_business':
      return [
        ['Dates', range(s(d.startDate), s(d.endDate))],
        ['Time', d.timeFrom && d.timeTo ? `${s(d.timeFrom)} – ${s(d.timeTo)}` : 'Whole day'],
        ['Place', s(d.location)],
      ]
    case 'overtime':
      return d.date && d.hours
        ? [
            ['Date', formatDate(s(d.date))],
            ['Hours', `${String(d.hours)} h`],
          ]
        : []
    default:
      return []
  }
}

/** The single day a filing is about (for showing that day's time record), if any */
export function filingDay(r: Pick<AzoneRequest, 'kind' | 'data'>): string | null {
  const d = r.data
  if (!d) return null
  if (r.kind === 'official_business') return d.startDate === d.endDate ? s(d.startDate) : null
  return s(d.date) || null
}

/** Overtime filed with structured date + hours can be approved without HR re-entering them */
export const overtimeReady = (r: Pick<AzoneRequest, 'kind' | 'data'>) => r.kind === 'overtime' && !!r.data?.date && !!r.data?.hours

const clock = /^([01]\d|2[0-3]):[0-5]\d$/

/** Form state for HR filing on an employee's behalf */
export type FilingForm = {
  kind: FilingKind
  date: string
  endDate: string
  timeIn: string
  breakOut: string
  breakIn: string
  timeOut: string
  timeFrom: string
  timeTo: string
  location: string
  hours: string
}

/** Validate the form and build the API `data`; returns an error message instead when something is off. */
export function buildFilingData(f: FilingForm, today: string): { data: Record<string, unknown> } | { error: string } {
  const opt = (v: string) => (v ? v : null)
  if (!f.date) return { error: 'Pick a date' }
  switch (f.kind) {
    case 'dtr_discrepancy':
    case 'no_dtr': {
      if (f.date > today) return { error: 'Time records can’t be filed for a future date' }
      if (!clock.test(f.timeIn) || !clock.test(f.timeOut)) return { error: 'Enter the time in and time out' }
      if (!!f.breakOut !== !!f.breakIn) return { error: 'Enter both break times, or neither' }
      return { data: { date: f.date, timeIn: f.timeIn, breakOut: opt(f.breakOut), breakIn: opt(f.breakIn), timeOut: f.timeOut } }
    }
    case 'undertime':
      if (f.date > today) return { error: 'Undertime can’t be filed for a future date' }
      if (!clock.test(f.timeOut)) return { error: 'Enter the time the employee left' }
      return { data: { date: f.date, timeOut: f.timeOut } }
    case 'official_business': {
      const end = f.endDate || f.date
      if (end < f.date) return { error: 'The end date must be on or after the start date' }
      if (!!f.timeFrom !== !!f.timeTo) return { error: 'Enter both times, or neither for whole days' }
      if (f.location.trim().length < 2) return { error: 'Enter where the official business is' }
      return { data: { startDate: f.date, endDate: end, timeFrom: opt(f.timeFrom), timeTo: opt(f.timeTo), location: f.location.trim() } }
    }
    case 'overtime': {
      const h = Number(f.hours)
      if (!(h >= 0.5 && h <= 16 && Number.isInteger(h * 2))) return { error: 'Enter 0.5 to 16 hours, in half hours' }
      if (f.date > today) return { error: 'Overtime can’t be filed for a future date' }
      return { data: { date: f.date, hours: h } }
    }
  }
}
