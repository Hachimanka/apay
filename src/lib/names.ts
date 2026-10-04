/**
 * Comparable form of a person's name for matching uploaded files to employees:
 * case, accents, punctuation and extra spaces are ignored, and "Cruz, Ana" reads the same as "Ana Cruz".
 */
export function nameKey(raw: unknown) {
  let s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  const comma = s.indexOf(',')
  if (comma > 0) s = `${s.slice(comma + 1)} ${s.slice(0, comma)}`
  return s
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Look employees up by name; a name shared by two employees is reported as ambiguous rather than guessed. */
export function nameIndex<T extends { name: string }>(people: T[]) {
  const map = new Map<string, T[]>()
  for (const p of people) {
    const k = nameKey(p.name)
    map.set(k, [...(map.get(k) ?? []), p])
  }
  return (raw: unknown): { found: T } | { error: 'missing' | 'unknown' | 'ambiguous' } => {
    const k = nameKey(raw)
    if (!k) return { error: 'missing' }
    const hits = map.get(k) ?? []
    if (hits.length > 1) return { error: 'ambiguous' }
    return hits[0] ? { found: hits[0] } : { error: 'unknown' }
  }
}

/** Header aliases for the employee-name column. */
export const nameHeaders = new Set(['name', 'employee', 'employeename', 'employeesname', 'fullname', 'staff', 'staffname'])
