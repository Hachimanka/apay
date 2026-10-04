import { Avatar } from '@/components/ui/Avatar'
import { useEmployeeAvatar } from '@/services/queries'
import type { Employee } from '@/services/types'

/** An employee's AZONE profile photo, loaded only when it's on screen (and cached until they change it). */
export function EmployeeAvatar({ employee, className }: { employee: Pick<Employee, 'id' | 'fullName' | 'avatarVersion'>; className?: string }) {
  const { data } = useEmployeeAvatar(employee.id, employee.avatarVersion)
  return <Avatar name={employee.fullName} src={data?.dataUrl} className={className} />
}
