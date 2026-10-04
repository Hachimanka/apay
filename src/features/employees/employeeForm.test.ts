import { describe, expect, it } from 'vitest'
import { nextEmployeeNo } from './employeeForm'

describe('nextEmployeeNo', () => {
  it('continues the company-wide number and uses the hire year', () => {
    expect(nextEmployeeNo(['AZN-2015-0114', 'AZN-2022-0261', 'AZN-2026-0177'], '2026-10-04')).toBe('AZN-2026-0262')
    expect(nextEmployeeNo(['AZN-2022-0261'], '2027-01-05')).toBe('AZN-2027-0262')
  })
  it('ignores numbers in other formats and starts at 0001 when there are none', () => {
    expect(nextEmployeeNo(['TEMP-1', 'azn-2024-0009 '], '2026-10-04')).toBe('AZN-2026-0010')
    expect(nextEmployeeNo([], '2026-10-04')).toBe('AZN-2026-0001')
  })
  it('keeps growing past 9999', () => {
    expect(nextEmployeeNo(['AZN-2026-9999'], '2026-10-04')).toBe('AZN-2026-10000')
  })
})
