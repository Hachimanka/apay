import { describe, expect, it } from 'vitest'
import { blankRecord, daysToExpiry, expiryBadge, movementFor, recordConfigs, sortRecords, validateRecord } from './records'
import type { EmployeeRecordKind } from '@/services/types'

describe('201 file records', () => {
  it('has a blank form for every kind, with required selects preset', () => {
    for (const kind of Object.keys(recordConfigs) as EmployeeRecordKind[]) {
      const blank = blankRecord(kind)
      expect(Object.keys(blank)).toEqual(recordConfigs[kind].fields.map((f) => f.key))
    }
    expect(blankRecord('education').level).toBe('high_school')
    expect(blankRecord('training').hours).toBeNull()
  })

  it('validates required fields, years and number ranges', () => {
    expect(validateRecord('education', { ...blankRecord('education') })).toEqual({ school: 'Required' })
    expect(validateRecord('education', { ...blankRecord('education'), school: 'X', yearGraduated: '15' })).toEqual({ yearGraduated: 'Use a 4-digit year' })
    expect(validateRecord('appraisal', { period: '2026 H1', rating: 6 })).toEqual({ rating: 'At most 5' })
    expect(validateRecord('child', { name: '  ' })).toEqual({ name: 'Required' })
    expect(validateRecord('child', { name: 'Ana' })).toEqual({})
  })

  it('flags expired and soon-to-expire licenses', () => {
    const today = new Date()
    const iso = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10)
    expect(daysToExpiry('')).toBeNull()
    expect(expiryBadge(iso(-1))?.tone).toBe('danger')
    expect(expiryBadge(iso(30))?.tone).toBe('warning')
    expect(expiryBadge(iso(400))?.tone).toBe('success')
  })

  it('sorts newest first by the main date, undated last', () => {
    const r = (id: string, startDate: string, createdAt = '2026-01-01') => ({ id, kind: 'training' as const, data: { startDate }, createdAt })
    expect(sortRecords([r('a', '2024-01-01'), r('b', ''), r('c', '2026-05-01')]).map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('movementFor', () => {
  const base = { position: 'Clerk', department: 'Finance', employmentType: 'Regular', status: 'active', monthlyBasic: '20000.00', payBasis: 'monthly', level: '' } as const
  it('matches the API rules', () => {
    expect(movementFor(base, { ...base, monthlyBasic: '20000' })).toBeNull()
    expect(movementFor(base, { ...base, payBasis: undefined })).toBeNull()
    expect(movementFor(base, { ...base, status: 'resigned' })?.type).toBe('separation')
    expect(movementFor(base, { ...base, department: 'IT' })?.type).toBe('transfer')
    expect(movementFor(base, { ...base, level: 'Supervisor' })?.type).toBe('position_change')
    expect(movementFor(base, { ...base, monthlyBasic: '25000.00' })?.details).toBe('Monthly basic: ₱20,000 → ₱25,000')
  })
})
