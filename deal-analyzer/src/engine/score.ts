/** §23 ValeForge Deal Score (100 points). Point functions are pure and individually testable. */
import { PROVISIONAL, SPEC } from './config'
import type { ArvConfidence, Num, RehabComplexity } from './types'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Equity / All-in; 20% = 25 points, linear below, 0 if ≤ 0. */
export function equityPoints(equityPct: number): number {
  const s = SPEC.score.equity
  return clamp01(equityPct / s.fullAtEquityPct) * s.max
}

/** Capital Recycled %; 90%+ = 25 points (linear below — PROVISIONAL). */
export function capitalPoints(recycledPct: number): number {
  const s = SPEC.score.capital
  return clamp01(recycledPct / s.fullAtRecycledPct) * s.max
}

/** DSCR 1.25+ = 20 points (linear on DSCR — PROVISIONAL). */
export function cashFlowPoints(dscr: number): number {
  const s = SPEC.score.cashFlow
  return clamp01(dscr / s.fullAtDscr) * s.max
}

/** 3+ viable exits = 15, 2 = 10, 1 = 5, 0 = 0. */
export function exitPoints(viableCount: number): number {
  const table = SPEC.score.exits.pointsByViableCount
  return table[Math.min(Math.max(0, Math.floor(viableCount)), table.length - 1)]
}

export interface RiskFactors {
  conservativeEquity: Num
  /** True when the value was calculated without some UNKNOWN line items. */
  conservativeEquityIncomplete?: boolean
  stressDscrIncomplete?: boolean
  stressFlipIncomplete?: boolean
  stressDscr: Num
  stressDebtService: Num
  minDscr: Num
  stressFlipProfit: Num
  complexity: RehabComplexity | null
  confidence: ArvConfidence | null
}

export interface RiskFactorResult {
  label: string
  points: Num
  max: number
}

/** Five risk factors × 3 points (PROVISIONAL weights). */
export function riskFactorPoints(f: RiskFactors): RiskFactorResult[] {
  const P = PROVISIONAL.score.risk
  // Partial values are optimistic: a failed factor is proven (0), a passed one is not (UNKNOWN).
  const pass = (ok: boolean | null, incomplete = false): Num =>
    ok === null ? null : !ok ? 0 : incomplete ? null : P.pointsPerFactor
  const stressDscrOk =
    f.stressDebtService === 0 ? true : f.stressDscr === null || f.minDscr === null ? null : f.stressDscr >= f.minDscr
  return [
    {
      label: 'Equity at Conservative ARV > 0',
      points: pass(f.conservativeEquity === null ? null : f.conservativeEquity > 0, f.conservativeEquityIncomplete),
      max: P.pointsPerFactor,
    },
    {
      label: 'Combined-stress DSCR ≥ lender minimum',
      points: pass(stressDscrOk, f.stressDebtService !== 0 && f.stressDscrIncomplete),
      max: P.pointsPerFactor,
    },
    {
      label: 'Combined-stress flip profit > 0',
      points: pass(f.stressFlipProfit === null ? null : f.stressFlipProfit > 0, f.stressFlipIncomplete),
      max: P.pointsPerFactor,
    },
    { label: 'Rehab complexity', points: f.complexity === null ? null : P.complexityPoints[f.complexity], max: P.pointsPerFactor },
    { label: 'ARV / comp confidence', points: f.confidence === null ? null : P.confidencePoints[f.confidence], max: P.pointsPerFactor },
  ]
}

export interface ScoreComponent {
  id: 'equity' | 'capital' | 'cashFlow' | 'exits' | 'risk'
  label: string
  max: number
  /** null = cannot be scored (missing data). */
  points: Num
  /** Points calculated from partial (optimistic) values — an upper bound, not final. */
  incomplete?: boolean
  detail: string
}

export interface DealScore {
  components: ScoreComponent[]
  /** Points earned from components that could be scored, rounded to 0.1. */
  total: number
  /** Upper bound: partial points (optimistic) + the max of unscored components. Used to decide PASS on incomplete deals. */
  maxAchievable: number
  complete: boolean
}

export const round1 = (x: number) => Math.round(x * 10) / 10

export function totalScore(components: ScoreComponent[]): DealScore {
  const earned = components.reduce((s, c) => s + (c.points ?? 0), 0)
  const unknown = components.reduce((s, c) => s + (c.points === null ? c.max : 0), 0)
  return {
    components,
    total: round1(earned),
    maxAchievable: round1(earned + unknown),
    complete: components.every((c) => c.points !== null && !c.incomplete),
  }
}
