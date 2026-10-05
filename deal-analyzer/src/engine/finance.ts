/**
 * Loan math. Pure functions, monthly compounding, rates as decimals (0.07 = 7%/yr).
 */

function assertNonNegative(name: string, v: number) {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a finite number ≥ 0 (got ${v})`)
}

/** Level monthly payment for a fully amortizing loan. */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  assertNonNegative('principal', principal)
  assertNonNegative('annualRate', annualRate)
  if (!Number.isInteger(termMonths) || termMonths <= 0) throw new RangeError('termMonths must be a positive integer')
  if (principal === 0) return 0
  const r = annualRate / 12
  if (r === 0) return principal / termMonths
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths))
}

export interface AmortizationRow {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

/** Real amortization schedule (§10) for the first `months` payments (defaults to full term). */
export function amortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  months: number = termMonths,
): AmortizationRow[] {
  const pmt = monthlyPayment(principal, annualRate, termMonths)
  const r = annualRate / 12
  const rows: AmortizationRow[] = []
  let balance = principal
  const n = Math.min(Math.max(0, Math.floor(months)), termMonths)
  for (let m = 1; m <= n; m++) {
    const interest = balance * r
    const principalPaid = Math.min(pmt - interest, balance)
    balance = balance - principalPaid
    rows.push({ month: m, payment: interest + principalPaid, interest, principal: principalPaid, balance: Math.max(0, balance) })
  }
  return rows
}

/** Total interest paid over the first `months` of an amortizing loan. */
export function amortizingInterest(principal: number, annualRate: number, termMonths: number, months: number): number {
  return amortizationSchedule(principal, annualRate, termMonths, months).reduce((s, r) => s + r.interest, 0)
}

/** Outstanding balance after `months` payments of an amortizing loan. */
export function remainingBalance(principal: number, annualRate: number, termMonths: number, months: number): number {
  const rows = amortizationSchedule(principal, annualRate, termMonths, months)
  return rows.length === 0 ? principal : rows[rows.length - 1].balance
}

/** §10 interest-only: Loan × Rate × Months / 12. */
export function interestOnlyInterest(principal: number, annualRate: number, months: number): number {
  assertNonNegative('principal', principal)
  assertNonNegative('annualRate', annualRate)
  assertNonNegative('months', months)
  return (principal * annualRate * months) / 12
}

/** Annual debt service of a loan (interest-only or amortizing). */
export function annualDebtService(principal: number, annualRate: number, termMonths: number, interestOnly: boolean): number {
  if (interestOnly) return principal * annualRate
  return monthlyPayment(principal, annualRate, termMonths) * 12
}
