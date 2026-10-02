import { useEffect } from 'react'
import { Select } from '@/components/ui/Field'
import { usePeriods } from '@/services/queries'
import { periodStatusLabel } from './StatusBadges'

type Props = { value: string; onChange: (id: string) => void; onlyComputed?: boolean }

/** Cut-off picker; defaults to the newest period (or newest computed one). */
export function PeriodSelect({ value, onChange, onlyComputed }: Props) {
  const { data } = usePeriods()
  const options = (data ?? []).filter((p) => !onlyComputed || p.headcount > 0)

  useEffect(() => {
    if (!value && options.length) onChange(options[0].id)
  }, [value, options, onChange])

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-56 py-2" aria-label="Payroll period">
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label} · {periodStatusLabel[p.status]}
        </option>
      ))}
    </Select>
  )
}
