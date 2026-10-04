import type { AttendanceRow } from '@/services/types'

/**
 * "2 / 11 · 9 upcoming": days actually present out of the cut-off's working days, with the days that haven't
 * happened yet shown apart (payroll counts them as present so it can be prepared before the cut-off ends).
 */
export function PresentDays({ row }: { row: Pick<AttendanceRow, 'daysPresent' | 'workingDays' | 'upcomingDays'> }) {
  const upcoming = row.upcomingDays ?? 0
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-navy">{row.daysPresent - upcoming}</span> <span className="text-muted">/ {row.workingDays}</span>
      {upcoming > 0 && (
        <span
          className="ml-1.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
          title={`${upcoming} working day${upcoming === 1 ? '' : 's'} of this cut-off haven’t happened yet. Payroll counts them as present until they do.`}
        >
          +{upcoming} upcoming
        </span>
      )}
    </span>
  )
}

/** Share of the working days that have already happened on which people were present. */
export function attendanceRate(rows: Pick<AttendanceRow, 'daysPresent' | 'workingDays' | 'upcomingDays'>[]) {
  const happened = rows.reduce((s, r) => s + r.workingDays - (r.upcomingDays ?? 0), 0)
  const present = rows.reduce((s, r) => s + r.daysPresent - (r.upcomingDays ?? 0), 0)
  return happened > 0 ? Math.round((present / happened) * 100) : null
}
