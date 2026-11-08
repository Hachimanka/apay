import { describe, expect, it } from 'vitest'
import { buildFilingData, filingDay, filingSummary, overtimeReady, type FilingForm } from './filings'

const base: FilingForm = {
  kind: 'no_dtr',
  date: '2026-11-03',
  endDate: '',
  timeIn: '08:00',
  breakOut: '',
  breakIn: '',
  timeOut: '17:00',
  timeFrom: '',
  timeTo: '',
  location: '',
  hours: '',
}
const today = '2026-11-07'

describe('buildFilingData', () => {
  it('builds time records with optional breaks', () => {
    expect(buildFilingData(base, today)).toEqual({ data: { date: '2026-11-03', timeIn: '08:00', breakOut: null, breakIn: null, timeOut: '17:00' } })
    expect(buildFilingData({ ...base, breakOut: '12:00' }, today)).toEqual({ error: 'Enter both break times, or neither' })
    expect(buildFilingData({ ...base, date: '2026-11-09' }, today)).toHaveProperty('error')
  })

  it('lets official business span days or be planned ahead', () => {
    const ob = { ...base, kind: 'official_business' as const, date: '2026-11-10', endDate: '2026-11-12', location: 'Pier 4' }
    expect(buildFilingData(ob, today)).toEqual({
      data: { startDate: '2026-11-10', endDate: '2026-11-12', timeFrom: null, timeTo: null, location: 'Pier 4' },
    })
    expect(buildFilingData({ ...ob, endDate: '2026-11-09' }, today)).toHaveProperty('error')
    expect(buildFilingData({ ...ob, location: ' ' }, today)).toHaveProperty('error')
  })

  it('checks overtime hours in half hours', () => {
    const ot = { ...base, kind: 'overtime' as const }
    expect(buildFilingData({ ...ot, hours: '2.5' }, today)).toEqual({ data: { date: '2026-11-03', hours: 2.5 } })
    expect(buildFilingData({ ...ot, hours: '2.3' }, today)).toHaveProperty('error')
  })
})

describe('filing summaries', () => {
  it('describes each kind and finds its day', () => {
    expect(filingSummary({ kind: 'undertime', data: { date: '2026-11-03', timeOut: '15:00' } })).toBe('Nov 3, 2026 · left at 15:00')
    expect(filingSummary({ kind: 'coe', data: null })).toBeNull()
    expect(filingDay({ kind: 'official_business', data: { startDate: '2026-11-03', endDate: '2026-11-04' } })).toBeNull()
    expect(filingDay({ kind: 'no_dtr', data: { date: '2026-11-03' } })).toBe('2026-11-03')
    expect(overtimeReady({ kind: 'overtime', data: { date: '2026-11-03', hours: 2 } })).toBe(true)
    expect(overtimeReady({ kind: 'overtime', data: null })).toBe(false)
  })
})
