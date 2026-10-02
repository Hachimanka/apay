import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarCheck, CalendarX, Clock, Timer } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { DataTable } from '@/components/ui/DataTable'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { Badge } from '@/components/ui/Badge'
import { PeriodSelect } from '@/components/shared/PeriodSelect'
import { useAttendance } from '@/services/queries'
import type { AttendanceRow } from '@/services/types'

const columns: ColumnDef<AttendanceRow>[] = [
  {
    accessorKey: 'name',
    header: 'Employee',
    cell: ({ row }) => (
      <span>
        <span className="block font-semibold text-navy">{row.original.name}</span>
        <span className="block text-xs text-muted">{row.original.employeeNo}</span>
      </span>
    ),
  },
  { accessorKey: 'department', header: 'Department' },
  {
    accessorKey: 'daysPresent',
    header: 'Present',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span className="font-semibold text-navy">
        {row.original.daysPresent} <span className="font-normal text-muted">/ {row.original.workingDays}</span>
      </span>
    ),
  },
  {
    accessorKey: 'absentDays',
    header: 'Absent',
    meta: { align: 'right' },
    cell: ({ getValue }) =>
      getValue<number>() ? (
        <Badge size="sm" tone="danger">
          {getValue<number>()}
        </Badge>
      ) : (
        0
      ),
  },
  {
    accessorKey: 'lateMinutes',
    header: 'Late (min)',
    meta: { align: 'right' },
    cell: ({ getValue }) =>
      getValue<number>() ? (
        <Badge size="sm" tone="warning">
          {getValue<number>()}
        </Badge>
      ) : (
        0
      ),
  },
  { accessorKey: 'overtimeHours', header: 'OT (hrs)', meta: { align: 'right' } },
  { accessorKey: 'paidLeaveDays', header: 'Paid leave', meta: { align: 'right' } },
  { accessorKey: 'unpaidLeaveDays', header: 'Unpaid leave', meta: { align: 'right' } },
]

export function AttendancePage() {
  const [periodId, setPeriodId] = useState('')
  const { data, isLoading } = useAttendance(periodId)
  const totals = (k: keyof AttendanceRow) => (data ?? []).reduce((s, r) => s + (r[k] as number), 0)

  const stats = [
    {
      icon: CalendarCheck,
      tone: 'success' as const,
      label: 'Attendance rate',
      value: data?.length ? `${Math.round((totals('daysPresent') / totals('workingDays')) * 100)}%` : '—',
    },
    { icon: CalendarX, tone: 'danger' as const, label: 'Absences', value: totals('absentDays') },
    { icon: Clock, tone: 'warning' as const, label: 'Late minutes', value: totals('lateMinutes') },
    { icon: Timer, tone: 'primary' as const, label: 'Overtime hours', value: totals('overtimeHours') },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Attendance & DTR"
        description="Daily time records from AZONE and biometrics, summarised per cut-off for payroll."
        actions={<PeriodSelect value={periodId} onChange={setPeriodId} />}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-xs text-muted sm:text-sm">{s.label}</p>
              <p className="text-xl font-bold text-navy">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <DataTable data={data} columns={columns} loading={isLoading || !periodId} searchPlaceholder="Search employee…" pageSize={12} />
    </>
  )
}
