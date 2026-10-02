import { format, parseISO } from 'date-fns'

const pesoWhole = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
const pesoCents = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Amounts arrive from the API as decimal strings. Whole pesos drop the centavos; otherwise always show two decimals. */
export function formatPeso(amount: string | number) {
  const n = Number(amount)
  return Number.isInteger(n) ? pesoWhole.format(n) : pesoCents.format(n)
}

export function formatDate(iso: string, pattern = 'MMM d, yyyy') {
  return format(parseISO(iso), pattern)
}

export function formatTime(iso: string | null) {
  return iso ? format(parseISO(iso), 'h:mm a') : '--'
}

export function formatPeriod(start: string, end: string) {
  const s = parseISO(start)
  const e = parseISO(end)
  return s.getMonth() === e.getMonth() ? `${format(s, 'MMMM d')} – ${format(e, 'd, yyyy')}` : `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
