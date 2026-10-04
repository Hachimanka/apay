import { describe, expect, it } from 'vitest'
import { punchError, readDate, readTime, readTimeRecords, slashOrder } from './timeRecords'

describe('readTime', () => {
  it('reads typed times in common formats', () => {
    expect(readTime('8:05')).toBe('08:05')
    expect(readTime('08:05:59')).toBe('08:05')
    expect(readTime('5:30 PM')).toBe('17:30')
    expect(readTime('12:15 am')).toBe('00:15')
    expect(readTime('1730')).toBe('17:30')
    expect(readTime('8')).toBe('08:00')
  })
  it('reads Excel time cells, day fractions and HHMM numbers', () => {
    expect(readTime(new Date(Date.UTC(1899, 11, 30, 7, 45)))).toBe('07:45')
    expect(readTime(0.75)).toBe('18:00')
    expect(readTime(46298.375)).toBe('09:00')
    expect(readTime(1730)).toBe('17:30')
  })
  it('treats blanks as no punch and rejects nonsense', () => {
    expect(readTime('')).toBeNull()
    expect(readTime(null)).toBeNull()
    expect(readTime('—')).toBeNull()
    expect(readTime('25:00')).toBeUndefined()
    expect(readTime('13 pm')).toBeUndefined()
    expect(readTime('late')).toBeUndefined()
  })
})

describe('readDate', () => {
  it('reads ISO, month-first and Excel dates', () => {
    expect(readDate('2026-10-03')).toBe('2026-10-03')
    expect(readDate('10/03/2026')).toBe('2026-10-03')
    expect(readDate(new Date(Date.UTC(2026, 9, 3)))).toBe('2026-10-03')
    expect(readDate(46298)).toBe('2026-10-03')
    expect(readDate('02/30/2026')).toBeUndefined()
  })
})

describe('punchError', () => {
  it('matches the API rules', () => {
    expect(punchError({ timeIn: '08:00', breakOut: '12:00', breakIn: '13:00', timeOut: '17:00' })).toBeNull()
    expect(punchError({ timeIn: '22:00', breakOut: null, breakIn: null, timeOut: '06:00' })).toBeNull()
    expect(punchError({ timeIn: null, breakOut: null, breakIn: null, timeOut: '17:00' })).toMatch(/Time in/)
    expect(punchError({ timeIn: '08:00', breakOut: '12:00', breakIn: null, timeOut: '17:00' })).toMatch(/both break/)
    expect(punchError({ timeIn: '08:00', breakOut: '07:00', breakIn: '06:00', timeOut: '05:00' })).toMatch(/order/)
    expect(punchError({ timeIn: '08:00', breakOut: null, breakIn: null, timeOut: '08:00' })).toMatch(/24 hours/)
  })
})

describe('readTimeRecords', () => {
  const roster = [
    { employeeId: 'e1', name: 'Ana Cruz' },
    { employeeId: 'e2', name: 'Ben Lim' },
    { employeeId: 'e3', name: 'José Peña' },
  ]

  it('matches by name only (any case, "Last, First", accents) and ignores an Employee No column', () => {
    const r = readTimeRecords(
      [
        ['Employee No', 'Name', 'Time In', 'Time Out'],
        ['WRONG-1', 'ana cruz', '8:00 AM', '5:00 PM'],
        ['', 'Lim, Ben', '', ''],
        ['', 'Jose  Pena', '7:55', '17:00'],
      ],
      roster,
      '2026-10-02',
      '2026-10-03',
    )
    expect(r.errors).toEqual([])
    expect(r.blank).toBe(1)
    expect(r.rows).toEqual([
      { employeeId: 'e1', date: '2026-10-02', timeIn: '08:00', breakOut: null, breakIn: null, timeOut: '17:00' },
      { employeeId: 'e3', date: '2026-10-02', timeIn: '07:55', breakOut: null, breakIn: null, timeOut: '17:00' },
    ])
  })

  it('handles a multi-day export with a title row above the header', () => {
    const r = readTimeRecords(
      [
        ['Biometric export — Oct 2026'],
        ['Employee Name', 'Date', 'AM In', 'AM Out', 'PM In', 'PM Out'],
        ['CRUZ, ANA', '10/01/2026', '7:58', '12:00', '13:00', '17:02'],
        ['Cruz, Ana', '10/02/2026', '8:10', '12:00', '13:00', '17:00'],
      ],
      roster,
      '2026-10-03',
      '2026-10-03',
    )
    expect(r.errors).toEqual([])
    expect(r.dates).toEqual(['2026-10-01', '2026-10-02'])
    expect(r.rows[1]).toMatchObject({ employeeId: 'e1', date: '2026-10-02', timeIn: '08:10', breakOut: '12:00', breakIn: '13:00', timeOut: '17:00' })
  })

  it('reports unknown or shared names, bad times, future days, duplicates and missing columns', () => {
    const twins = [...roster, { employeeId: 'e4', name: 'Ben Lim' }]
    const r = readTimeRecords(
      [
        ['Name', 'Date', 'Time In', 'Time Out'],
        ['Nobody Here', '2026-10-01', '8:00', '17:00'],
        ['Ana Cruz', '2026-10-01', 'eight', '17:00'],
        ['Ana Cruz', '2026-10-09', '8:00', '17:00'],
        ['José Peña', '2026-10-01', '8:00', '17:00'],
        ['Jose Pena', '2026-10-01', '9:00', '18:00'],
        ['Ben Lim', '2026-10-01', '8:00', '17:00'],
      ],
      twins,
      '2026-10-03',
      '2026-10-03',
    )
    expect(r.rows).toHaveLength(1)
    expect(r.errors).toHaveLength(5)
    expect(r.errors[0]).toMatch(/no active employee named "Nobody Here"/)
    expect(r.errors[1]).toMatch(/can’t read time in/)
    expect(r.errors[2]).toMatch(/future/)
    expect(r.errors[3]).toMatch(/more than once/)
    expect(r.errors[4]).toMatch(/more than one employee is named "Ben Lim"/)
    expect(readTimeRecords([['Employee No', 'Time In']], roster, '2026-10-03', '2026-10-03').errors[0]).toMatch(/"Name" column/)
  })
})

describe('day-first vs month-first dates', () => {
  it('reads slash dates in the order it is told', () => {
    expect(readDate('01/10/2026', true)).toBe('2026-10-01')
    expect(readDate('01/10/2026', false)).toBe('2026-01-10')
  })
  it('lets a part above 12 decide, otherwise picks the reading nearest the day being viewed', () => {
    expect(slashOrder(['01/10/2026', '13/10/2026'], '2026-01-12', '2026-10-20')).toEqual({ dayFirst: true })
    expect(slashOrder(['10/01/2026', '10/13/2026'], '2026-01-12', '2026-10-20')).toEqual({ dayFirst: false })
    // Viewing Oct 2: 01/10 and 02/10 mean October 1 and 2, not January 10 and February 10
    expect(slashOrder(['01/10/2026', '02/10/2026'], '2026-10-02', '2026-10-03')).toEqual({ dayFirst: true })
    // Viewing Jan 10: 01/10 is January 10
    expect(slashOrder(['01/10/2026'], '2026-01-10', '2026-10-03')).toEqual({ dayFirst: false })
    // Never choose a reading that lands in the future
    // Viewing Oct 5: 05/11 as 5 November would be nearer but is in the future, so it's 11 May
    expect(slashOrder(['05/11/2026'], '2026-10-05', '2026-10-05')).toEqual({ dayFirst: false })
    expect(slashOrder(['13/10/2026', '10/13/2026'], '2026-10-02', '2026-10-20')).toHaveProperty('error')
  })
  it('imports an Excel-saved day-first file as October, not January', () => {
    const r = readTimeRecords(
      [
        ['Name', 'Date', 'Time In', 'Time Out'],
        ['Ana Cruz', '01/10/2026', '7:52', '17:00'],
        ['Ana Cruz', '02/10/2026', '8:00', '17:00'],
      ],
      [{ employeeId: 'e1', name: 'Ana Cruz' }],
      '2026-10-02',
      '2026-10-03',
    )
    expect(r.errors).toEqual([])
    expect(r.dates).toEqual(['2026-10-01', '2026-10-02'])
  })
})
