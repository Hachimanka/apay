import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, Users, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { nameKey } from '@/lib/names'

export type EmployeeOption = { id: string; name: string; department: string }

/** Pick one or more employees to narrow a table to. An empty selection means everyone. */
export function EmployeeFilter({ options, value, onChange }: { options: EmployeeOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => new Set(value), [value])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const sorted = useMemo(() => [...options].sort((a, b) => a.name.localeCompare(b.name)), [options])
  const shown = useMemo(() => {
    const q = nameKey(query)
    return q ? sorted.filter((o) => nameKey(`${o.name} ${o.department}`).includes(q)) : sorted
  }, [sorted, query])

  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  const picked = options.filter((o) => selected.has(o.id))
  const label = !picked.length ? 'All employees' : picked.length === 1 ? picked[0].name : `${picked.length} employees`

  return (
    <div ref={box} className="relative">
      <div
        className={cn(
          'flex items-center rounded-xl border bg-surface text-sm transition',
          picked.length ? 'border-primary text-primary ring-4 ring-primary-100' : 'border-line text-navy hover:border-primary-200',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 py-2 pr-2 pl-3 font-semibold"
        >
          <Users className="size-4 shrink-0" />
          <span className="max-w-44 truncate">{label}</span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {picked.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            aria-label="Show all employees"
            title="Show all employees"
            className="mr-1.5 rounded-lg p-1 hover:bg-primary-50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-float">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an employee…"
              className="w-full rounded-xl border border-line bg-bg py-2 pr-3 pl-9 text-sm text-navy placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-100 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between px-1.5 pt-2 pb-1 text-xs">
            <button
              type="button"
              disabled={!shown.length}
              onClick={() => onChange([...new Set([...value, ...shown.map((o) => o.id)])])}
              className="font-semibold text-primary hover:underline disabled:opacity-40"
            >
              Select {query ? 'these' : 'all'} ({shown.length})
            </button>
            <button
              type="button"
              disabled={!value.length}
              onClick={() => onChange([])}
              className="font-semibold text-muted hover:text-primary disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const on = selected.has(o.id)
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(o.id)}
                    className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition', on ? 'bg-primary-50' : 'hover:bg-bg')}
                  >
                    <span
                      className={cn(
                        'flex size-4.5 shrink-0 items-center justify-center rounded-md border transition',
                        on ? 'border-primary bg-primary text-white' : 'border-line bg-surface',
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy">{o.name}</span>
                      <span className="block truncate text-xs text-muted">{o.department}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {!shown.length && <li className="px-2.5 py-6 text-center text-sm text-muted">No employee matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
