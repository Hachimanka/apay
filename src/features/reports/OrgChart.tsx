import type { ReportCell } from '@/services/types'

type Node = { id: string; name: string; position: string; department: string; managerId: string | null; manager: string }

/** Build reporting trees: employees whose manager is another employee hang under them; the rest are roots. */
export function buildTree(rows: Record<string, ReportCell>[]) {
  const nodes = rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    position: String(r.position ?? ''),
    department: String(r.department ?? ''),
    managerId: r.managerId ? String(r.managerId) : null,
    manager: String(r.manager ?? ''),
  }))
  const ids = new Set(nodes.map((n) => n.id))
  const children = new Map<string, Node[]>()
  for (const n of nodes) if (n.managerId && ids.has(n.managerId) && n.managerId !== n.id) children.set(n.managerId, [...(children.get(n.managerId) ?? []), n])
  const roots = nodes.filter((n) => !n.managerId || !ids.has(n.managerId) || n.managerId === n.id)
  return { roots, children }
}

/** Organizational chart (checklist #53) as nested cards, grouped by the top person's department. */
export function OrgChart({ rows }: { rows: Record<string, ReportCell>[] }) {
  const { roots, children } = buildTree(rows)
  const depts = [...new Set(roots.map((r) => r.department))].sort()
  return (
    <div className="space-y-6">
      {depts.map((d) => (
        <section key={d}>
          <h3 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{d || 'No department'}</h3>
          <ul className="space-y-2">
            {roots
              .filter((r) => r.department === d)
              .sort((a, b) => (children.get(b.id)?.length ?? 0) - (children.get(a.id)?.length ?? 0) || a.name.localeCompare(b.name))
              .map((r) => (
                <Branch key={r.id} node={r} childrenOf={children} depth={0} seen={new Set()} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Branch({ node, childrenOf, depth, seen }: { node: Node; childrenOf: Map<string, Node[]>; depth: number; seen: Set<string> }) {
  const kids = seen.has(node.id) ? [] : (childrenOf.get(node.id) ?? [])
  const next = new Set(seen).add(node.id)
  return (
    <li>
      <div className="inline-flex min-w-64 flex-col rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card">
        <span className="font-semibold text-navy">{node.name}</span>
        <span className="text-xs text-muted">
          {node.position}
          {kids.length ? ` · ${kids.length} direct report${kids.length === 1 ? '' : 's'}` : ''}
          {!node.managerId && node.manager ? ` · reports to ${node.manager}` : ''}
        </span>
      </div>
      {kids.length > 0 && depth < 12 && (
        <ul className="mt-2 ml-6 space-y-2 border-l-2 border-primary-100 pl-4">
          {kids.map((k) => (
            <Branch key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} seen={next} />
          ))}
        </ul>
      )}
    </li>
  )
}
