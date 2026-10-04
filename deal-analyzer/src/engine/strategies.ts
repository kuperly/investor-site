/**
 * §26 Deal Strategy Engine — separate economics for BRRRR, Hold, Flip, Hybrid.
 * Viability rules are PROVISIONAL (spec names "viable exits" without defining them).
 */
import type { Num, Ratio, Strategy, Tri } from './types'
import { INFINITE } from './types'
import type { CoreResult } from './underwrite'

export interface StrategyResult {
  strategy: Strategy
  viable: Tri
  reason: string
  /** Annual return on capital that stays in the deal (used to pick best use of capital). */
  annualReturnOnCapital: Ratio
}

export interface StrategyEvaluation {
  brrrr: StrategyResult
  hold: StrategyResult
  flip: StrategyResult
  hybrid: StrategyResult & { bestUseOfCapital: Exclude<Strategy, 'Hybrid'> | null; rationale: string }
  viableCount: number
  /** True when at least one strategy's viability is UNKNOWN. */
  incomplete: boolean
}

const and = (...xs: Tri[]): Tri => (xs.some((x) => x === false) ? false : xs.some((x) => x === null) ? null : true)
const or = (...xs: Tri[]): Tri => (xs.some((x) => x === true) ? true : xs.some((x) => x === null) ? null : false)
const gt0 = (v: Num): Tri => (v === null ? null : v > 0)

export function evaluateStrategies(base: CoreResult, minDscr: Num): StrategyEvaluation {
  // BRRRR — post-refi cash flow positive and DSCR at or above the lender minimum.
  const brrrrDscrOk: Tri =
    base.refi.annualDebtService === 0 ? true : base.refi.dscr === null || minDscr === null ? null : base.refi.dscr >= minDscr
  const brrrrViable = and(gt0(base.refi.annualCashFlow), brrrrDscrOk)
  const brrrr: StrategyResult = {
    strategy: 'BRRRR',
    viable: brrrrViable,
    reason:
      brrrrViable === null
        ? 'Cannot evaluate — missing cash flow, DSCR or lender minimum DSCR'
        : brrrrViable
          ? 'Positive post-refi cash flow and DSCR meets lender minimum'
          : 'Post-refi cash flow ≤ 0 or DSCR below lender minimum',
    annualReturnOnCapital: base.refi.cashOnCash,
  }

  const holdViable = gt0(base.hold.annualCashFlow)
  const hold: StrategyResult = {
    strategy: 'Hold',
    viable: holdViable,
    reason:
      holdViable === null
        ? 'Cannot evaluate — missing rental or acquisition-financing data'
        : holdViable
          ? 'Positive cash flow on acquisition financing'
          : 'Cash flow on acquisition financing ≤ 0',
    annualReturnOnCapital: base.hold.cashOnCash,
  }

  const flipViable = gt0(base.flip.netProfit)
  const flipAnnualized: Ratio =
    base.flip.roi === null || base.flip.months === null || base.flip.months <= 0
      ? null
      : (base.flip.roi * 12) / base.flip.months
  const flip: StrategyResult = {
    strategy: 'Flip',
    viable: flipViable,
    reason:
      flipViable === null ? 'Cannot evaluate — missing sale or cost data' : flipViable ? 'Positive net flip profit' : 'Net flip profit ≤ 0',
    annualReturnOnCapital: flipAnnualized,
  }

  const hybridViable = and(or(brrrrViable, holdViable), flipViable)

  // Best use of capital: highest annual return among viable strategies.
  const candidates = [brrrr, hold, flip].filter((s) => s.viable === true && s.annualReturnOnCapital !== null)
  const rank = (r: Ratio) => (r === INFINITE ? Number.POSITIVE_INFINITY : (r as number))
  candidates.sort((a, b) => rank(b.annualReturnOnCapital) - rank(a.annualReturnOnCapital))
  const best = candidates[0] ?? null
  const bestUseOfCapital = (best?.strategy ?? null) as Exclude<Strategy, 'Hybrid'> | null

  const hybrid = {
    strategy: 'Hybrid' as const,
    viable: hybridViable,
    reason:
      hybridViable === null
        ? 'Cannot evaluate — a component strategy is unknown'
        : hybridViable
          ? 'Both a rental exit and a flip exit are viable'
          : 'Needs both a viable rental exit (BRRRR/Hold) and a viable flip',
    annualReturnOnCapital: best?.annualReturnOnCapital ?? null,
    bestUseOfCapital,
    rationale: best
      ? `${best.strategy} has the highest annual return on capital left in the deal among viable strategies`
      : 'No viable strategy with a computable return',
  }

  const all = [brrrr, hold, flip, hybrid]
  return {
    brrrr,
    hold,
    flip,
    hybrid,
    viableCount: all.filter((s) => s.viable === true).length,
    incomplete: all.some((s) => s.viable === null),
  }
}
