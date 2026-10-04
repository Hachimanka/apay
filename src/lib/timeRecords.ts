import { nameHeaders, nameIndex } from './names'
import type { DailyRow, Punches, TimeRecordInput } from '@/services/types'

export const punchKeys = ['timeIn', 'breakOut', 'breakIn', 'timeOut'] as const
export type PunchKey = (typeof punchKeys)[number]

export const punchLabels: Record<PunchKey, string> = { timeIn: 'Time in', breakOut: 'Break out', breakIn: 'Break in', timeOut: 'Time out' }

export const emptyPunches: Punches = { timeIn: null, breakOut: null, breakIn: null, timeOut: null }

const pad = (n: number) => String(n).padStart(2, '0')

/** Same rules as the API: time in first, both break punches or neither, in order (one midnight crossing allowed), under 24 h. */
export function punchError(p: Punches): string | null {
  const filled = punchKeys.filter((k) => p[k])
  if (!filled.length) return null
  if (!p.timeIn) return 'Time in is required'
  if (!!p.breakOut !== !!p.breakIn) return 'Enter both break times, or neither'
  let offset = 0
  let first = -1
  let prev = -1
  for (const k of filled) {
    const [h, m] = p[k]!.split(':').map(Number)
    let t = h * 60 + m + offset
    if (t <= prev) {
      if (offset) return 'Times are out of order'
      offset = 24 * 60
      t += offset
    }
    if (first < 0) first = t
    prev = t
  }
  return prev - first >= 24 * 60 ? 'Shift is 24 hours or longer' : null
}

export const samePunches = (a: Punches, b: Punches) => punchKeys.every((k) => (a[k] ?? null) === (b[k] ?? null))

/* ------------------------------- Reading cells ------------------------------- */

type Cell = string | number | boolean | Date | null | undefined

/** Excel serial day 0 = 1899-12-30 */
const excelDate = (serial: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000))

/** 'HH:mm' from typed text ("8:05", "08:05:00", "5:30 PM", "1730"), an Excel time cell, or a fraction of a day. */
export function readTime(cell: Cell): string | null | undefined {
  if (cell == null || cell === '') return null
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? undefined : `${pad(cell.getUTCHours())}:${pad(cell.getUTCMinutes())}`
  if (typeof cell === 'number') {
    if (!(cell >= 0)) return undefined
    // A whole number typed into a cell is a clock time like 800 or 1730, not a date
    if (Number.isInteger(cell) && cell >= 1) return cell <= 2359 && cell % 100 < 60 ? `${pad(Math.floor(cell / 100))}:${pad(cell % 100)}` : undefined
    const minutes = Math.round((cell % 1) * 24 * 60) % (24 * 60)
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
  }
  const s = String(cell).trim().toLowerCase().replace(/\s+/g, '')
  if (!s || s === '-' || s === '—') return null
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(?::\d{2})?(am|pm|a|p)?$/)
  if (!m) return undefined
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const ampm = m[3]
  if (ampm) {
    if (h < 1 || h > 12) return undefined
    if (ampm.startsWith('p') && h !== 12) h += 12
    if (ampm.startsWith('a') && h === 12) h = 0
  }
  return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : undefined
}

const slashDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

/**
 * 'yyyy-MM-dd' from "2026-10-03", a slash date or an Excel date cell. Slash dates are ambiguous ("01/10/2026" is
 * 1 October day-first, 10 January month-first), so the caller says which order the file uses — see `slashOrder`.
 */
export function readDate(cell: Cell, dayFirst = false): string | null | undefined {
  if (cell == null || cell === '') return null
  const d = cell instanceof Date ? cell : typeof cell === 'number' ? excelDate(cell) : null
  if (d) return Number.isNaN(d.getTime()) ? undefined : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const s = String(cell).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(slashDate)
  if (m) return dayFirst ? valid(+m[3], +m[2], +m[1]) : valid(+m[3], +m[1], +m[2])
  return undefined
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000

/**
 * Decide how a file's slash dates are ordered. A part above 12 settles it (13/10 must be day-first). When every
 * date fits both ways, pick the reading that isn't in the future and lands closest to the day being viewed —
 * "01/10/2026" uploaded while looking at Oct 2 is 1 October, not 10 January. (Excel writes CSV dates in the
 * Windows regional format, which the browser can't see, so the computer's language setting can't decide this.)
 */
export function slashOrder(values: Cell[], viewing: string, today: string): { dayFirst: boolean } | { error: string } {
  const slash = values.flatMap((v) => {
    const m = typeof v === 'string' ? v.trim().match(slashDate) : null
    return m ? [m] : []
  })
  if (!slash.length) return { dayFirst: false }
  const forced = { day: slash.some((m) => +m[1] > 12), month: slash.some((m) => +m[2] > 12) }
  if (forced.day && forced.month) return { error: 'The Date column mixes day-first and month-first dates — use one format, ideally yyyy-mm-dd.' }
  if (forced.day || forced.month) return { dayFirst: forced.day }

  const score = (dayFirst: boolean) => {
    const days = slash.map((m) => (dayFirst ? valid(+m[3], +m[2], +m[1]) : valid(+m[3], +m[1], +m[2])))
    if (days.some((d) => !d)) return Infinity
    const future = days.filter((d) => d! > today).length
    return future * 1e6 + days.reduce((s, d) => s + Math.abs(dayNumber(d!) - dayNumber(viewing)), 0)
  }
  return { dayFirst: score(true) < score(false) }
}

function valid(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : undefined
}

/* ------------------------------- File import ------------------------------- */

type Column = 'name' | 'date' | PunchKey

const aliases: Record<string, Column> = {
  ...Object.fromEntries([...nameHeaders].map((h) => [h, 'name' as const])),
  date: 'date',
  day: 'date',
  workdate: 'date',
  timein: 'timeIn',
  in: 'timeIn',
  clockin: 'timeIn',
  amin: 'timeIn',
  breakout: 'breakOut',
  lunchout: 'breakOut',
  amout: 'breakOut',
  breakin: 'breakIn',
  lunchin: 'breakIn',
  pmin: 'breakIn',
  timeout: 'timeOut',
  out: 'timeOut',
  clockout: 'timeOut',
  pmout: 'timeOut',
}

const norm = (h: Cell) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

export const templateColumns = ['Name', 'Date', 'Time In', 'Break Out', 'Break In', 'Time Out'] as const

export function timeRecordTemplate(date: string, rows: DailyRow[]) {
  return rows.map((r) => ({
    Name: r.name,
    Date: date,
    'Time In': r.timeIn ?? '',
    'Break Out': r.breakOut ?? '',
    'Break In': r.breakIn ?? '',
    'Time Out': r.timeOut ?? '',
  }))
}

export type TimeImport = { rows: TimeRecordInput[]; errors: string[]; blank: number; dates: string[] }

/**
 * Read a sheet (CSV or Excel) of daily time records. One row per employee per day, matched by the employee's name
 * ("Ana Cruz" or "Cruz, Ana"; case and accents don't matter). Without a Date column every row is for `defaultDate`.
 * Rows with no times at all are skipped (they never clear a record).
 */
export function readTimeRecords(
  sheet: Cell[][],
  roster: { employeeId: string; name: string }[],
  defaultDate: string,
  today: string,
): TimeImport {
  const result: TimeImport = { rows: [], errors: [], blank: 0, dates: [] }
  const headerAt = sheet.findIndex((r) => r.some((c) => aliases[norm(c)] === 'name'))
  if (headerAt < 0) return { ...result, errors: ['Couldn’t find a "Name" column — start from the template.'] }
  const col = new Map<Column, number>()
  sheet[headerAt].forEach((h, i) => {
    const key = aliases[norm(h)]
    if (key && !col.has(key)) col.set(key, i)
  })
  if (!col.has('timeIn')) return { ...result, errors: ['Couldn’t find a "Time In" column — start from the template.'] }
  const order = col.has('date') ? slashOrder(sheet.slice(headerAt + 1).map((r) => r[col.get('date')!]), defaultDate, today) : { dayFirst: false }
  if ('error' in order) return { ...result, errors: [order.error] }

  const find = nameIndex(roster)
  const seen = new Set<string>()
  const dates = new Set<string>()

  sheet.slice(headerAt + 1).forEach((cells, i) => {
    const line = headerAt + i + 2
    const get = (c: Column) => (col.has(c) ? cells[col.get(c)!] : null)
    if (cells.every((c) => c == null || String(c).trim() === '')) return
    const rawName = String(get('name') ?? '').trim()
    const match = find(rawName)
    if ('error' in match)
      return void result.errors.push(
        match.error === 'missing'
          ? `Row ${line}: the name is blank`
          : match.error === 'ambiguous'
            ? `Row ${line}: more than one employee is named "${rawName}" — enter that person’s times on the page`
            : `Row ${line}: no active employee named "${rawName}"`,
      )
    const emp = match.found

    const date = col.has('date') ? readDate(get('date'), order.dayFirst) : defaultDate
    if (date === undefined) return void result.errors.push(`Row ${line} (${emp.name}): can’t read the date — use yyyy-mm-dd`)
    const day = date ?? defaultDate
    if (day > today) return void result.errors.push(`Row ${line} (${emp.name}): ${day} is in the future`)

    const p = { ...emptyPunches }
    for (const k of punchKeys) {
      const t = readTime(get(k))
      if (t === undefined) return void result.errors.push(`Row ${line} (${emp.name}): can’t read ${punchLabels[k].toLowerCase()} "${String(get(k))}"`)
      p[k] = t
    }
    if (punchKeys.every((k) => !p[k])) return void result.blank++
    const problem = punchError(p)
    if (problem) return void result.errors.push(`Row ${line} (${emp.name}, ${day}): ${problem.toLowerCase()}`)

    const key = `${emp.employeeId}|${day}`
    if (seen.has(key)) return void result.errors.push(`Row ${line}: ${emp.name} appears more than once for ${day}`)
    seen.add(key)
    dates.add(day)
    result.rows.push({ employeeId: emp.employeeId, date: day, ...p })
  })
  result.dates = [...dates].sort()
  return result
}

/* ------------------------------- Calendar days ------------------------------- */

/** Today's date in the Philippines, 'yyyy-MM-dd' (payroll days are Manila days wherever the browser is). */
export const manilaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

export function shiftDay(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
