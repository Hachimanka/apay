# APAY — Aznar Payroll Platform

Payroll operations PWA for HR, Payroll, Finance and authorized management: employees, attendance & DTR, overtime,
leave impact, payroll periods (compute → review → approve → release), payslips, allowances & deductions,
government deductions, reports, announcements and settings.
It is separate from **AZONE** (the employee app); both talk to **aznar-api**.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · TanStack Query · TanStack Table v8 · Recharts ·
decimal.js · Zustand · React Hook Form + Zod · Motion · Radix UI · Lucide · vite-plugin-pwa · Vitest

## Getting started (PowerShell)

```powershell
copy .env.example .env    # VITE_API_MODE=mock works without a backend
npm install
npm run dev               # http://localhost:5174  (AZONE uses 5173)
npm test                  # payroll engine unit tests
```

Demo mode: any email/password, and pick a **Demo role** on the login page. Demo data lives in memory, so a full page
reload resets it. To test approvals: compute and submit as **Payroll Admin**, then use *Sign out* (not reload) and sign
in as **Finance** to approve and release.

## Payroll engine

`src/lib/payroll.ts` computes a semi-monthly cut-off with `decimal.js` (money is always a 2-decimal string):
basic pay, absences/unpaid leave, lates, overtime premiums, allowances (de minimis vs taxable), SSS, PhilHealth,
Pag-IBIG, BIR withholding (TRAIN table) and loans. Rates reflect 2025 schedules — confirm against the latest
circulars each year. In production this module should run in **aznar-api**; the UI only displays results.

## Roles

| | Payroll Admin | HR | Finance | Management |
|---|---|---|---|---|
| Compute payroll | ✓ | | | |
| Approve payroll | | | ✓ | ✓ |
| Release payroll | ✓ | | ✓ | |
| Manage employees | ✓ | ✓ | | |
| Settings | ✓ | | | |

Defined in `src/lib/permissions.ts`. The real API must enforce the same rules server-side.

## Structure

```
src/
  lib/payroll.ts        Payroll engine (+ payroll.test.ts)
  lib/permissions.ts    Role → permission map
  components/ui/        Design-system primitives + DataTable
  components/charts/    Recharts wrappers (validated palette)
  components/shared/    Stepper, status badges, payslip view, period picker
  features/landing/     Public landing page (/)
  layouts/              App shell with grouped sidebar
  pages/                Modules under /app
  services/             API contract (types.ts), mock + HTTP adapters, React Query hooks
```
