import { describe, expect, it } from 'vitest'
import { buildTree } from './OrgChart'
import { formatCell, reportCsv } from './ReportLibrary'

describe('org chart', () => {
  it('nests reports under their manager and survives loops', () => {
    const { roots, children } = buildTree([
      { id: 'a', name: 'Ana', department: 'Ops', managerId: null, manager: '' },
      { id: 'b', name: 'Ben', department: 'Ops', managerId: 'a', manager: 'Ana' },
      { id: 'c', name: 'Cy', department: 'Ops', managerId: 'b', manager: 'Ben' },
      { id: 'd', name: 'Di', department: 'HR', managerId: 'zz', manager: 'Someone Else' },
      { id: 'e', name: 'Ed', department: 'HR', managerId: 'e', manager: 'Ed' },
    ])
    expect(roots.map((r) => r.id)).toEqual(['a', 'd', 'e'])
    expect(children.get('a')?.map((x) => x.id)).toEqual(['b'])
    expect(children.get('b')?.map((x) => x.id)).toEqual(['c'])
    expect(children.has('e')).toBe(false)
  })
})

describe('report export', () => {
  it('uses the column labels and appends totals', () => {
    const csv = reportCsv({
      key: 'x',
      title: 'X',
      description: '',
      columns: [
        { key: 'name', label: 'Employee' },
        { key: 'cost', label: 'Cost', type: 'money' },
      ],
      rows: [{ name: 'Ana', cost: '100.00' }],
      totals: { name: 'Total', cost: '100.00' },
    })
    expect(csv).toEqual([
      { Employee: 'Ana', Cost: '100.00' },
      { Employee: 'Total', Cost: '100.00' },
    ])
    expect(formatCell(12.5, 'percent')).toBe('12.5%')
    expect(formatCell(null, 'money')).toBe('—')
  })
})
