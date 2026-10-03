import { describe, expect, it } from 'vitest'
import type { AttendanceRow } from '@/services/types'
import { parseCsv } from './csv'
import { readAttendanceCsv } from './attendanceImport'

const row = (employeeNo: string, name: string): AttendanceRow => ({
  employeeId: `id-${employeeNo}`,
  employeeNo,
  name,
  department: 'IT',
  workingDays: 11,
  daysPresent: 11,
  absentDays: 0,
  lateMinutes: 0,
  overtimeHours: 0,
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  source: 'dtr',
})
const roster = [row('AZN-1', 'Ana Cruz'), row('AZN-2', 'Ben Lim'), row('AZN-3', 'Cara Tan')]

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and the Excel BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
  it('detects semicolon-separated exports and skips blank lines', () => {
    expect(parseCsv('a;b\n\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('readAttendanceCsv', () => {
  it('matches by Employee No and keeps only changed rows', () => {
    const csv = 'Employee No,Name,Present,Absent,Late (min),Paid leave,Unpaid leave\nazn-1,Ana,9,2,15,0,0\nAZN-2,Ben,11,0,0,0,0'
    const r = readAttendanceCsv(csv, roster)
    expect(r.errors).toEqual([])
    expect(r.unchanged).toBe(1)
    expect(r.changes.map((c) => c.input)).toEqual([
      { employeeId: 'id-AZN-1', daysPresent: 9, absentDays: 2, lateMinutes: 15, paidLeaveDays: 0, unpaidLeaveDays: 0 },
    ])
  })

  it('fills in a blank Present and treats missing columns as 0', () => {
    const r = readAttendanceCsv('emp no,absent,lwop\nAZN-3,1,0.5', roster)
    expect(r.changes[0].input).toMatchObject({ daysPresent: 9.5, absentDays: 1, unpaidLeaveDays: 0.5, lateMinutes: 0 })
  })

  it('reports unknown employees, duplicates, bad numbers and totals that do not add up', () => {
    const csv = ['Employee No,Present,Absent', 'AZN-9,11,0', 'AZN-1,10,1', 'AZN-1,10,1', 'AZN-2,10,0.3', 'AZN-3,10,0'].join('\n')
    const r = readAttendanceCsv(csv, roster)
    expect(r.changes).toHaveLength(1)
    expect(r.errors).toHaveLength(4)
    expect(r.errors[0]).toMatch(/Row 2: no active employee/)
    expect(r.errors[1]).toMatch(/more than once/)
    expect(r.errors[2]).toMatch(/whole or half/)
    expect(r.errors[3]).toMatch(/must equal 11 working days/)
  })

  it('rejects a file without the key columns', () => {
    expect(readAttendanceCsv('Name,Present\nAna,11', roster).errors[0]).toMatch(/Employee No/)
  })
})
