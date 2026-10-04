/** Same rules aznar-api enforces when a password is reset (src/routes/passwordLinks.ts). */
export const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'At least one letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'At least one number', test: (p: string) => /\d/.test(p) },
] as const

export const meetsPasswordRules = (p: string) => passwordRules.every((r) => r.test(p))
