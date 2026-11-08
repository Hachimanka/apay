import { useState } from 'react'
import { Lock, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useDeleteEmployeeRecord, useSaveEmployeeRecord } from '@/services/queries'
import type { EmployeeRecord, EmployeeRecordKind, RecordValue } from '@/services/types'
import { cn } from '@/lib/cn'
import { blankRecord, recordConfigs, sortRecords, validateRecord, type FieldDef } from './records'

type Props = {
  employeeId: string
  kind: EmployeeRecordKind
  icon: LucideIcon
  records: EmployeeRecord[] | undefined
  canManage: boolean
  className?: string
}

/** One kind of 201-file record: a list with add / edit / delete. */
export function RecordSection({ employeeId, kind, icon, records, canManage, className }: Props) {
  const config = recordConfigs[kind]
  const [editing, setEditing] = useState<{ id?: string; data: Record<string, RecordValue> } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmployeeRecord | null>(null)
  const rows = records ? sortRecords(records.filter((r) => r.kind === kind)) : undefined

  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <CardHeader
        icon={icon}
        title={
          <span>
            {config.title}
            {rows && rows.length > 0 && <span className="ml-2 text-sm font-semibold text-muted">{rows.length}</span>}
          </span>
        }
        className="mb-3"
        action={
          canManage && (
            <Button size="sm" variant="soft" onClick={() => setEditing({ data: blankRecord(kind) })}>
              <Plus className="size-4" /> Add
            </Button>
          )
        }
      />
      {!rows ? (
        <Skeleton className="h-16" />
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-muted italic">{config.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const sum = config.summary(r.data)
            return (
              <li key={r.id} className="group flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold break-words text-navy">{sum.title}</p>
                    {sum.badge && (
                      <Badge size="sm" tone={sum.badge.tone}>
                        {sum.badge.label}
                      </Badge>
                    )}
                  </div>
                  {sum.subtitle && <p className="mt-0.5 text-sm break-words text-muted">{sum.subtitle}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {sum.meta && <span className="mr-1 text-xs whitespace-nowrap text-muted">{sum.meta}</span>}
                  {r.auto ? (
                    <span title="Logged automatically — read-only" className="p-1.5 text-muted/60">
                      <Lock className="size-3.5" />
                    </span>
                  ) : (
                    canManage && (
                      <>
                        <IconButton label={`Edit ${config.singular}`} onClick={() => setEditing({ id: r.id, data: { ...blankRecord(kind), ...r.data } })}>
                          <Pencil className="size-3.5" />
                        </IconButton>
                        <IconButton label={`Delete ${config.singular}`} danger onClick={() => setConfirmDelete(r)}>
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </>
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <RecordDialog employeeId={employeeId} kind={kind} initial={editing} onClose={() => setEditing(null)} />}
      {confirmDelete && <DeleteDialog record={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </Card>
  )
}

function IconButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('rounded-lg p-1.5 text-muted transition hover:bg-primary-50', danger ? 'hover:text-danger' : 'hover:text-primary')}
    >
      {children}
    </button>
  )
}

function RecordDialog({
  employeeId,
  kind,
  initial,
  onClose,
}: {
  employeeId: string
  kind: EmployeeRecordKind
  initial: { id?: string; data: Record<string, RecordValue> }
  onClose: () => void
}) {
  const config = recordConfigs[kind]
  const save = useSaveEmployeeRecord()
  const [data, setData] = useState(initial.data)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (f: FieldDef, raw: string) =>
    setData((d) => ({ ...d, [f.key]: f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateRecord(kind, data)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
    await save.mutateAsync({ id: initial.id, employeeId, kind, data: clean })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`${initial.id ? 'Edit' : 'Add'} ${config.singular}`}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        {config.fields.map((f) => (
          <div key={f.key} className={f.wide || f.type === 'textarea' ? 'col-span-2' : undefined}>
            <Field label={f.required ? `${f.label} *` : f.label} error={errors[f.key]}>
              <FieldControl field={f} value={data[f.key]} onChange={(v) => set(f, v)} />
            </Field>
          </div>
        ))}
        <div className="col-span-2 mt-2">
          {save.isError && <p className="mb-2 text-sm text-danger">{save.error.message}</p>}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : initial.id ? 'Save changes' : `Add ${config.singular}`}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function FieldControl({ field: f, value, onChange }: { field: FieldDef; value: RecordValue | undefined; onChange: (v: string) => void }) {
  const v = value === null || value === undefined ? '' : String(value)
  switch (f.type) {
    case 'textarea':
      return <Textarea className="min-h-20" value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
    case 'select':
      return (
        <Select value={v} onChange={(e) => onChange(e.target.value)}>
          {f.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )
    case 'date':
      return <Input type="date" value={v} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <Input type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
    case 'year':
      return <Input inputMode="numeric" maxLength={4} value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} />
    default:
      return <Input value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
  }
}

function DeleteDialog({ record, onClose }: { record: EmployeeRecord; onClose: () => void }) {
  const config = recordConfigs[record.kind]
  const del = useDeleteEmployeeRecord()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Delete this ${config.singular}?`} description={config.summary(record.data).title}>
      <p className="mb-4 text-sm text-muted">This removes it from the employee’s 201 file. The deletion is kept in the audit trail.</p>
      {del.isError && <p className="mb-2 text-sm text-danger">{del.error.message}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-danger hover:bg-danger/90"
          disabled={del.isPending}
          onClick={async () => {
            await del.mutateAsync({ employeeId: record.employeeId, id: record.id })
            onClose()
          }}
        >
          {del.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </Dialog>
  )
}
