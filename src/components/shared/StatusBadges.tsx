import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { ApprovalStatus, EmploymentStatus, PeriodStatus } from '@/services/types'

const periodTones: Record<PeriodStatus, BadgeTone> = {
  draft: 'neutral',
  computed: 'primary',
  review: 'warning',
  approved: 'violet',
  released: 'success',
}

export const periodStatusLabel: Record<PeriodStatus, string> = {
  draft: 'Draft',
  computed: 'Computed',
  review: 'For review',
  approved: 'Approved',
  released: 'Released',
}

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  return (
    <Badge size="sm" tone={periodTones[status]}>
      {periodStatusLabel[status]}
    </Badge>
  )
}

const approvalTones: Record<ApprovalStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return (
    <Badge size="sm" tone={approvalTones[status]}>
      {status}
    </Badge>
  )
}

const employmentTones: Record<EmploymentStatus, BadgeTone> = { active: 'success', on_leave: 'warning', resigned: 'neutral' }

export function EmploymentBadge({ status }: { status: EmploymentStatus }) {
  return (
    <Badge size="sm" tone={employmentTones[status]}>
      {status.replace('_', ' ')}
    </Badge>
  )
}
