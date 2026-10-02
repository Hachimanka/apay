import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Megaphone, Plus } from 'lucide-react'
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { useAnnouncements, useSaveAnnouncement } from '@/services/queries'
import type { Announcement, AnnouncementCategory } from '@/services/types'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { formatDate } from '@/lib/format'

const tones: Record<AnnouncementCategory, BadgeTone> = { HR: 'primary', General: 'success', Policy: 'violet', Event: 'warning' }

export function AnnouncementsPage() {
  const { data, isLoading } = useAnnouncements()
  const role = useAuth((s) => s.session?.user.role)
  const canManage = can(role, 'announcements.manage') || can(role, 'payroll.process')
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Announcements"
        description="Published announcements appear on every employeeâ€™s AZONE dashboard."
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> New announcement
            </Button>
          )
        }
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.length ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((a) => (
            <button key={a.id} disabled={!canManage} onClick={() => setEditing(a)} className="card card-hover flex flex-col p-5 text-left">
              <div className="flex items-center gap-2">
                <Badge size="sm" tone={tones[a.category]} className="normal-case">
                  {a.category}
                </Badge>
                <Badge size="sm" tone={a.status === 'published' ? 'success' : 'neutral'}>
                  {a.status}
                </Badge>
              </div>
              <h3 className="mt-3 font-bold text-navy">{a.title}</h3>
              <p className="mt-1 text-xs text-muted">
                {formatDate(a.publishedAt)} Â· {a.author}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-muted">{a.body}</p>
            </button>
          ))}
        </div>
      )}
      {editing && <AnnouncementDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

const schema = z.object({
  category: z.enum(['HR', 'General', 'Policy', 'Event']),
  title: z.string().trim().min(4, 'Add a title'),
  body: z.string().trim().min(10, 'Write a short message'),
  audience: z.string(),
})

type FormValues = z.infer<typeof schema>

function AnnouncementDialog({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const save = useSaveAnnouncement()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: item ?? { category: 'HR', audience: 'all' } })

  const submit = (status: Announcement['status']) =>
    handleSubmit(async (v) => {
      await save.mutateAsync({ ...v, status, id: item?.id })
      onClose()
    })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={item ? 'Edit announcement' : 'New announcement'}>
      <form className="space-y-4" onSubmit={submit('published')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select {...register('category')}>
              {Object.keys(tones).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Audience">
            <Select {...register('audience')}>
              <option value="all">All employees</option>
              <option>IT Department</option>
              <option>HR Department</option>
              <option>Finance</option>
              <option>Operations</option>
              <option>Sales & Marketing</option>
              <option>Customer Service</option>
            </Select>
          </Field>
        </div>
        <Field label="Title" error={errors.title?.message}>
          <Input {...register('title')} />
        </Field>
        <Field label="Message" error={errors.body?.message}>
          <Textarea rows={6} {...register('body')} />
        </Field>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" disabled={save.isPending} onClick={submit('draft')}>
            Save draft
          </Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            Publish to AZONE
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
