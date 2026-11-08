import Decimal from 'decimal.js'

/**
 * APAY payroll engine — semi-monthly cut-offs.
 * All money math uses Decimal and returns 2-decimal strings. Never use JS floats for pesos.
 *
 * Statutory rates below reflect 2025 schedules. HR must confirm against the latest
 * SSS / PhilHealth / Pag-IBIG / BIR circulars before each year (see Settings → Government tables).
 */

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export type Money = string
const D = (v: Decimal.Value) => new Decimal(v)
const money = (v: Decimal) => v.toDecimalPlaces(2).toFixed(2)

/** Monthly ↔ daily factor: paid on workdays only (Mon–Fri), regular holidays included. Company decision. */
export const WORKING_DAYS_PER_YEAR = 261
export const HOURS_PER_DAY = 8

/**
 * Overtime = hours beyond 8 on a day, paid per hour at these multiples of the basic hourly rate
 * (Labor Code: +25% on ordinary days; +30% of the day's rate on rest days and holidays).
 * The first 8 hours on a rest day or holiday are paid from the time records (see DAY_RATES), not as overtime.
 */
export const OT_MULTIPLIERS = {
  regular: '1.25',
  restDay: '1.69',
  specialHoliday: '1.69',
  regularHoliday: '2.60',
} as const

export type OvertimeKind = keyof typeof OT_MULTIPLIERS

/** What kind of day an employee worked, from the holiday calendar and their shift's rest days. */
export type DayType = 'ordinary' | 'rest' | 'special' | 'special_rest' | 'regular' | 'regular_rest'

/** Pay for the first 8 hours worked, as a multiple of the daily rate. */
export const DAY_RATES: Record<DayType, string> = {
  ordinary: '1.00',
  rest: '1.30',
  special: '1.30',
  special_rest: '1.50',
  regular: '2.00',
  regular_rest: '2.60',
}

/** Overtime (beyond 8 hours) on each kind of day, as a multiple of the hourly rate. */
export const DAY_OT_RATES: Record<DayType, string> = {
  ordinary: '1.25',
  rest: '1.69',
  special: '1.69',
  special_rest: '1.95',
  regular: '2.60',
  regular_rest: '3.38',
}

/** Overtime filings carry a kind; when the date's actual day type isn't known, this is the fallback. */
export const overtimeKindDay: Record<OvertimeKind, DayType> = {
  regular: 'ordinary',
  restDay: 'rest',
  specialHoliday: 'special',
  regularHoliday: 'regular',
}

/** Night differential: extra share of the basic hourly rate for each hour worked 10:00 PM – 6:00 AM (paid at 110%). */
export const NIGHT_DIFF_RATE = '0.10'

export type PayBasis = 'monthly' | 'daily'

/* ------------------------------ Statutory tables ------------------------------ */

export const SSS = { rate: '0.15', employeeRate: '0.05', employerRate: '0.10', mscMin: '5000', mscMax: '35000', mscStep: '500' }
export const PHILHEALTH = { rate: '0.05', employeeShare: '0.5', floor: '10000', ceiling: '100000' }
export const PAGIBIG = { employeeRate: '0.02', employerRate: '0.02', maxFundSalary: '10000' }

/** BIR withholding tax table (TRAIN, 2023 onwards) — semi-monthly. */
export const BIR_SEMI_MONTHLY = [
  { over: '0', base: '0', rate: '0' },
  { over: '10417', base: '0', rate: '0.15' },
  { over: '16667', base: '937.50', rate: '0.20' },
  { over: '33333', base: '4270.70', rate: '0.25' },
  { over: '83333', base: '16770.70', rate: '0.30' },
  { over: '333333', base: '91770.70', rate: '0.35' },
]

/* --------------------------------- Rates --------------------------------- */

export function dailyRate(monthlyBasic: Money) {
  return D(monthlyBasic).times(12).div(WORKING_DAYS_PER_YEAR)
}

export function hourlyRate(monthlyBasic: Money) {
  return dailyRate(monthlyBasic).div(HOURS_PER_DAY)
}

/* --------------------------- Government contributions --------------------------- */

/** Monthly Salary Credit: monthly compensation rounded to the nearest ₱500 bracket, clamped. */
export function sssMsc(monthlyCompensation: Money) {
  const step = D(SSS.mscStep)
  const msc = D(monthlyCompensation).div(step).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(step)
  return Decimal.min(Decimal.max(msc, SSS.mscMin), SSS.mscMax)
}

/** Monthly contributions — split evenly across the two cut-offs. */
export function sssMonthly(monthlyCompensation: Money) {
  const msc = sssMsc(monthlyCompensation)
  return { employee: money(msc.times(SSS.employeeRate)), employer: money(msc.times(SSS.employerRate)) }
}

export function philhealthMonthly(monthlyBasic: Money) {
  const base = Decimal.min(Decimal.max(D(monthlyBasic), PHILHEALTH.floor), PHILHEALTH.ceiling)
  const premium = base.times(PHILHEALTH.rate)
  const employee = premium.times(PHILHEALTH.employeeShare)
  return { employee: money(employee), employer: money(premium.minus(employee)) }
}

export function pagibigMonthly(monthlyBasic: Money) {
  const base = Decimal.min(D(monthlyBasic), PAGIBIG.maxFundSalary)
  return { employee: money(base.times(PAGIBIG.employeeRate)), employer: money(base.times(PAGIBIG.employerRate)) }
}

export function withholdingTaxSemiMonthly(taxableIncome: Money) {
  const income = D(taxableIncome)
  if (income.lte(0)) return '0.00'
  const bracket = [...BIR_SEMI_MONTHLY].reverse().find((b) => income.gt(b.over))!
  return money(D(bracket.base).plus(income.minus(bracket.over).times(bracket.rate)))
}

/** BIR annual income tax table (TRAIN, 2023 onwards) — for the year-end / final pay tax adjustment. */
export const BIR_ANNUAL = [
  { over: '0', base: '0', rate: '0' },
  { over: '250000', base: '0', rate: '0.15' },
  { over: '400000', base: '22500', rate: '0.20' },
  { over: '800000', base: '102500', rate: '0.25' },
  { over: '2000000', base: '402500', rate: '0.30' },
  { over: '8000000', base: '2202500', rate: '0.35' },
]

export function annualIncomeTax(taxableIncome: Money) {
  const income = D(taxableIncome)
  if (income.lte(0)) return '0.00'
  const bracket = [...BIR_ANNUAL].reverse().find((b) => income.gt(b.over))!
  return money(D(bracket.base).plus(income.minus(bracket.over).times(bracket.rate)))
}

/** 13th month pay and other benefits (bonuses) are tax-exempt up to this much a year (TRAIN). */
export const BENEFITS_EXEMPT_CAP = '90000'
/** Monetized unused vacation leave is de minimis (non-taxable) up to this many days a year. */
export const VL_CONVERSION_EXEMPT_DAYS = 10

/** 13th month pay: basic salary actually earned in the year (after absences and lates) ÷ 12. */
export function thirteenthMonth(basicEarned: Money) {
  return money(Decimal.max(D(basicEarned), 0).div(12))
}

/** Split an amount against what's left of a yearly exemption: returns the exempt part and the taxable rest. */
export function splitExempt(amount: Money, exemptLeft: Money) {
  const exempt = Decimal.min(Decimal.max(D(exemptLeft), 0), D(amount))
  return { exempt: money(exempt), taxable: money(D(amount).minus(exempt)) }
}

/* ------------------------------- Cut-off payslip ------------------------------- */

export type CutoffInput = {
  monthlyBasic: Money
  /** Non-taxable de minimis (rice, laundry…) for this cut-off */
  deMinimis: Money
  /** Taxable allowances for this cut-off */
  taxableAllowances: Money
  absentDays: number
  unpaidLeaveDays: number
  lateMinutes: number
  /** Minutes left before shift end (deducted like lates, on the same "Late / Undertime" line) */
  undertimeMinutes?: number
  /** Approved overtime (hours beyond 8). `day` is the date's actual type; without it the kind decides the rate. */
  overtime: { kind: OvertimeKind; hours: number; day?: DayType }[]
  /** Loan amortizations and other post-tax deductions for this cut-off */
  otherDeductions: { label: string; amount: Money }[]
  /** Monthly-paid (default): half the monthly basic per cut-off. Daily-paid: daily rate × days paid. */
  payBasis?: PayBasis
  /** Daily-paid only: workdays present (incl. assumed-present upcoming days) */
  daysPresent?: number
  /** Daily-paid only: paid leave days */
  paidLeaveDays?: number
  /** Daily-paid only: regular holidays on a workday that weren't worked (paid 100%) */
  unworkedRegularHolidays?: number
  /** Hours worked (first 8 per day) on rest days and holidays, from the time records */
  dayWork?: { type: Exclude<DayType, 'ordinary'>; hours: number }[]
  /** Hours worked between 10 PM and 6 AM */
  nightHours?: number
  /** One-time earnings this cut-off: 13th month, bonuses, leave conversion, other entries (all added to gross) */
  extraEarnings?: Money
  /** The part of extraEarnings that's tax-exempt (13th month/bonuses under the ₱90,000 cap, VL conversion up to 10 days, non-taxable entries) */
  extraExempt?: Money
}

export type CutoffResult = {
  basicPay: Money
  /** Rest-day and holiday work (first 8 hours per day) */
  holidayPay: Money
  nightDiffPay: Money
  overtimePay: Money
  allowances: Money
  absencesDeduction: Money
  lateDeduction: Money
  /** One-time earnings (13th month, bonuses, leave conversion…) */
  extraEarnings: Money
  grossPay: Money
  sss: Money
  philhealth: Money
  pagibig: Money
  taxableIncome: Money
  withholdingTax: Money
  otherDeductions: Money
  totalDeductions: Money
  netPay: Money
  employer: { sss: Money; philhealth: Money; pagibig: Money }
}

/**
 * Pay for rest-day / holiday work on top of basic pay.
 * Monthly-paid (261 factor): basic already pays regular and special holidays, so only the premium is added
 * (e.g. +100% on a worked regular holiday); rest days aren't in basic, so they're paid in full.
 * Daily-paid: no day is in basic except days worked, so every worked rest day / holiday is paid in full.
 */
export function holidayDayRate(type: Exclude<DayType, 'ordinary'>, basis: PayBasis) {
  const rate = D(DAY_RATES[type])
  const coveredByBasic = basis === 'monthly' && (type === 'special' || type === 'regular')
  return coveredByBasic ? rate.minus(1) : rate
}

export function computeCutoff(input: CutoffInput): CutoffResult {
  const basis = input.payBasis ?? 'monthly'
  const daily = dailyRate(input.monthlyBasic)
  const hourly = daily.div(HOURS_PER_DAY)

  // Daily-paid: no work, no pay — absences simply aren't paid instead of being deducted
  const basic =
    basis === 'daily'
      ? daily.times((input.daysPresent ?? 0) + (input.paidLeaveDays ?? 0) + (input.unworkedRegularHolidays ?? 0))
      : D(input.monthlyBasic).div(2)
  const absences = basis === 'daily' ? D(0) : daily.times(input.absentDays + input.unpaidLeaveDays)
  const late = hourly.div(60).times(input.lateMinutes + (input.undertimeMinutes ?? 0))
  const holidayPay = (input.dayWork ?? []).reduce((s, w) => s.plus(hourly.times(w.hours).times(holidayDayRate(w.type, basis))), D(0))
  const nightDiff = hourly.times(input.nightHours ?? 0).times(NIGHT_DIFF_RATE)
  const overtime = input.overtime.reduce(
    (sum, ot) => sum.plus(hourly.times(ot.day ? DAY_OT_RATES[ot.day] : OT_MULTIPLIERS[ot.kind]).times(ot.hours)),
    D(0),
  )
  const allowances = D(input.deMinimis).plus(input.taxableAllowances)

  const extra = D(input.extraEarnings ?? 0)
  const extraExempt = Decimal.min(D(input.extraExempt ?? 0), extra)
  const gross = basic.minus(absences).minus(late).plus(holidayPay).plus(nightDiff).plus(overtime).plus(allowances).plus(extra)

  // Contributions are computed monthly and split in half per cut-off
  const half = (v: Money) => D(v).div(2)
  const sss = sssMonthly(input.monthlyBasic)
  const ph = philhealthMonthly(input.monthlyBasic)
  const hdmf = pagibigMonthly(input.monthlyBasic)
  const contributions = half(sss.employee).plus(half(ph.employee)).plus(half(hdmf.employee))

  const taxable = Decimal.max(gross.minus(input.deMinimis).minus(extraExempt).minus(contributions), 0)
  const tax = withholdingTaxSemiMonthly(money(taxable))
  const other = input.otherDeductions.reduce((s, d) => s.plus(d.amount), D(0))

  const totalDeductions = contributions.plus(tax).plus(other)

  return {
    basicPay: money(basic),
    holidayPay: money(holidayPay),
    nightDiffPay: money(nightDiff),
    overtimePay: money(overtime),
    allowances: money(allowances),
    absencesDeduction: money(absences),
    lateDeduction: money(late),
    extraEarnings: money(extra),
    grossPay: money(gross),
    sss: money(half(sss.employee)),
    philhealth: money(half(ph.employee)),
    pagibig: money(half(hdmf.employee)),
    taxableIncome: money(taxable),
    withholdingTax: tax,
    otherDeductions: money(other),
    totalDeductions: money(totalDeductions),
    netPay: money(gross.minus(totalDeductions)),
    employer: { sss: money(half(sss.employer)), philhealth: money(half(ph.employer)), pagibig: money(half(hdmf.employer)) },
  }
}

/** Sum a list of decimal strings safely. */
export function sum(values: Money[]) {
  return money(values.reduce((s, v) => s.plus(v), D(0)))
}
