/**
 * analyzeDeal — the single entry point the UI, API and export use.
 * Inputs in, complete underwriting out. No I/O, no React.
 */
import { SPEC } from './config'
import { FIELD_BY_KEY } from './fields'
import { evaluateGates, type GateResult } from './gates'
import { recommend, type RecommendationResult } from './recommendation'
import {
  capitalPoints,
  cashFlowPoints,
  equityPoints,
  exitPoints,
  riskFactorPoints,
  totalScore,
  type DealScore,
  type RiskFactorResult,
  type ScoreComponent,
} from './score'
import { STRESS_SCENARIOS, toStressRow, type StressRow } from './stress'
import { evaluateStrategies, type StrategyEvaluation } from './strategies'
import type { DealInputs, InputKey, Num } from './types'
import { InputReader, maxOffer, underwriteCore, type ArvKey, type CoreResult, type MaxOfferResult } from './underwrite'

export interface ArvScenario {
  key: ArvKey
  label: string
  arv: Num
  allIn: Num
  equity: Num
  equityPct: Num
  allInToArv: Num
  maxOffer: MaxOfferResult
}

export interface DataWarning {
  field: InputKey
  message: string
}

export interface DealAnalysis {
  base: CoreResult
  /** Conservative ARV + Conservative rent. */
  conservativeCase: CoreResult
  arvScenarios: ArvScenario[]
  stress: StressRow[]
  strategies: StrategyEvaluation
  gates: GateResult[]
  score: DealScore
  riskFactors: RiskFactorResult[]
  recommendation: RecommendationResult
  missing: DataWarning[]
  notices: string[]
  why: { strengths: string[]; risks: string[] }
}

const ARV_LABELS: Record<ArvKey, string> = {
  arvConservative: 'Conservative',
  arvBase: 'Base',
  arvUpside: 'Upside',
}

export function missingMessage(key: InputKey): string {
  const f = FIELD_BY_KEY[key]
  const what = f?.missingMessage ?? `${(f?.label ?? key).toLowerCase()} required`
  return `Underwriting incomplete — ${what}.`
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export interface AnalyzeOptions {
  /** Comp-supported ARV (see comps.ts compArv); informs the "Why?" text only. */
  compArv?: Num
}

export function analyzeDeal(inputs: DealInputs, opts: AnalyzeOptions = {}): DealAnalysis {
  const reader = new InputReader(inputs)
  const base = underwriteCore(inputs, {}, reader)
  const conservativeCase = underwriteCore(inputs, { arvKey: 'arvConservative', rentKey: 'conservativeRent' }, reader)
  const upside = underwriteCore(inputs, { arvKey: 'arvUpside', rentKey: 'upsideRent' }, reader)
  const targetPct = reader.num('targetAllInPct')
  const minDscr = reader.num('refiMinDscr')

  const arvScenarios: ArvScenario[] = (
    [
      ['arvConservative', conservativeCase],
      ['arvBase', base],
      ['arvUpside', upside],
    ] as const
  ).map(([key, c]) => ({
    key,
    label: ARV_LABELS[key],
    arv: c.arv,
    allIn: c.totalProjectCost,
    equity: c.equityCreated,
    equityPct: c.equityCreationPct,
    allInToArv: c.allInToArv,
    maxOffer: maxOffer(c, targetPct),
  }))

  const stressCores = STRESS_SCENARIOS.map((s) => ({ s, core: underwriteCore(inputs, s.opts, new InputReader(inputs)) }))
  const stress = stressCores.map(({ s, core }) => toStressRow(s.id, s.label, core))
  const combined = stressCores.find((x) => x.s.id === 'combined')!.core

  const strategies = evaluateStrategies(base, minDscr)
  const gates = evaluateGates(inputs, base, strategies, minDscr)

  // §23 score
  const riskFactors = riskFactorPoints({
    conservativeEquity: conservativeCase.equityCreated,
    stressDscr: combined.refi.dscr,
    stressDebtService: combined.refi.annualDebtService,
    minDscr,
    stressFlipProfit: combined.flip.netProfit,
    complexity: inputs.rehabComplexity,
    confidence: inputs.arvConfidence,
  })
  if (inputs.rehabComplexity === null) reader.flag('rehabComplexity')
  if (inputs.arvConfidence === null) reader.flag('arvConfidence')

  const S = SPEC.score
  const recycled = base.refi.capitalRecycledPct
  const invested = base.refi.totalCashInvested
  const components: ScoreComponent[] = [
    {
      id: 'equity',
      label: 'Equity Creation',
      max: S.equity.max,
      points: base.equityCreationPct === null ? null : equityPoints(base.equityCreationPct),
      detail: base.equityCreationPct === null ? 'Unknown' : `${pct(base.equityCreationPct)} equity / all-in (full at ${pct(S.equity.fullAtEquityPct)})`,
    },
    {
      id: 'capital',
      label: 'Capital Efficiency',
      max: S.capital.max,
      points:
        invested !== null && invested <= 0 ? S.capital.max : recycled === null ? null : capitalPoints(recycled),
      detail:
        invested !== null && invested <= 0
          ? 'No cash invested'
          : recycled === null
            ? 'Unknown'
            : `${pct(recycled)} capital recycled (full at ${pct(S.capital.fullAtRecycledPct)})`,
    },
    {
      id: 'cashFlow',
      label: 'Cash Flow',
      max: S.cashFlow.max,
      points:
        base.refi.annualDebtService === 0 && base.refi.annualCashFlow !== null
          ? base.refi.annualCashFlow > 0
            ? S.cashFlow.max
            : 0
          : base.refi.dscr === null
            ? null
            : cashFlowPoints(base.refi.dscr),
      detail: base.refi.dscr === null ? (base.refi.annualDebtService === 0 ? 'No refi debt' : 'Unknown') : `DSCR ${base.refi.dscr.toFixed(2)} (full at ${S.cashFlow.fullAtDscr})`,
    },
    {
      id: 'exits',
      label: 'Exit Flexibility',
      max: S.exits.max,
      // Unknown viability could still add exits → only final when nothing is unknown,
      // unless the known count already earns the maximum.
      points:
        strategies.incomplete && exitPoints(strategies.viableCount) < S.exits.max ? null : exitPoints(strategies.viableCount),
      detail: `${strategies.viableCount} viable exit(s)${strategies.incomplete ? ' (some unknown)' : ''}`,
    },
    {
      id: 'risk',
      label: 'Risk / Stress',
      max: S.risk.max,
      points: riskFactors.some((r) => r.points === null) ? null : riskFactors.reduce((s, r) => s + (r.points ?? 0), 0),
      detail: riskFactors.map((r) => `${r.label}: ${r.points === null ? '?' : r.points}/${r.max}`).join(' · '),
    },
  ]
  const score = totalScore(components)

  const missing: DataWarning[] = [...reader.missing].map((field) => ({ field, message: missingMessage(field) }))

  const notices: string[] = []
  if (
    inputs.refiSeasoningMonths !== null &&
    inputs.projectMonths !== null &&
    inputs.projectMonths < inputs.refiSeasoningMonths
  ) {
    notices.push(
      `Refi modeled at month ${inputs.projectMonths}, but the lender seasoning requirement is ${inputs.refiSeasoningMonths} months.`,
    )
  }
  for (const s of arvScenarios) {
    if (s.maxOffer.maxPurchasePrice !== null && s.maxOffer.maxPurchasePrice <= 0) {
      notices.push(`Max Offer at ${s.label} ARV is ≤ $0 — the target All-in / ARV is unreachable with current costs.`)
    }
  }

  const recommendation = recommend(score, gates, missing.length === 0)
  const why = explain({ base, conservativeCase, combined, strategies, gates, minDscr, inputs, missing, compArv: opts.compArv ?? null })

  return {
    base,
    conservativeCase,
    arvScenarios,
    stress,
    strategies,
    gates,
    score,
    riskFactors,
    recommendation,
    missing,
    notices,
    why,
  }
}

/** §28 human-readable "Why?" — generated only from computed facts. */
function explain(a: {
  base: CoreResult
  conservativeCase: CoreResult
  combined: CoreResult
  strategies: StrategyEvaluation
  gates: GateResult[]
  minDscr: Num
  inputs: DealInputs
  missing: DataWarning[]
  compArv: Num
}): { strengths: string[]; risks: string[] } {
  const S = SPEC.score
  const strengths: string[] = []
  const risks: string[] = []
  const { base } = a

  const eq = base.equityCreationPct
  if (eq !== null) {
    if (eq >= S.equity.fullAtEquityPct) strengths.push(`${pct(eq)} equity creation`)
    else if (eq > 0) risks.push(`Equity creation ${pct(eq)} — below the ${pct(S.equity.fullAtEquityPct)} target`)
    else risks.push(`No equity created at Base ARV (${pct(eq)})`)
  }

  const rec = base.refi.capitalRecycledPct
  if (rec !== null) {
    if (rec >= S.capital.fullAtRecycledPct) strengths.push(`${pct(rec)} capital recycled`)
    else risks.push(`Only ${pct(rec)} of capital recycled at refi`)
  }

  const dscr = base.refi.dscr
  if (dscr !== null) {
    if (dscr >= S.cashFlow.fullAtDscr) strengths.push(`DSCR ${dscr.toFixed(2)}`)
    else risks.push(`DSCR ${dscr.toFixed(2)} — below the ${S.cashFlow.fullAtDscr} target`)
  }

  const cf = base.refi.monthlyCashFlow
  if (cf !== null) {
    if (cf > 0) strengths.push('Positive cash flow')
    else risks.push('Negative post-refi cash flow')
  }

  const viable = [a.strategies.brrrr, a.strategies.hold, a.strategies.flip].filter((s) => s.viable === true).map((s) => s.strategy)
  if (viable.length >= 2) strengths.push(`${joinList(viable)} exits remain viable`)
  else if (viable.length === 1) risks.push(`Only one viable exit (${viable[0]})`)

  if (a.inputs.arvConfidence && a.inputs.arvConfidence !== 'High') risks.push(`ARV confidence: ${a.inputs.arvConfidence}`)
  if (a.inputs.rehabComplexity === 'Heavy' || a.inputs.rehabComplexity === 'Major')
    risks.push(`Rehab complexity: ${a.inputs.rehabComplexity}`)

  const cd = a.conservativeCase.refi.dscr
  if (cd !== null && dscr !== null && cd < dscr && cd < S.cashFlow.fullAtDscr)
    risks.push(`Conservative scenario reduces DSCR to ${cd.toFixed(2)}`)
  if (a.conservativeCase.equityCreated !== null && a.conservativeCase.equityCreated <= 0)
    risks.push('No equity at Conservative ARV')

  const sd = a.combined.refi.dscr
  if (sd !== null && a.minDscr !== null && sd < a.minDscr)
    risks.push(`Combined stress drops DSCR to ${sd.toFixed(2)} (lender min ${a.minDscr.toFixed(2)})`)
  const sf = a.combined.flip.netProfit
  if (sf !== null && sf <= 0) risks.push('Flip loses money under combined stress')

  for (const g of a.gates) if (g.status === 'FAIL') risks.push(`Hard gate: ${g.label}`)
  if (a.compArv !== null && a.compArv > 0 && a.inputs.arvBase !== null) {
    const gap = (a.inputs.arvBase - a.compArv) / a.compArv
    if (gap > 0) risks.push(`Base ARV is ${pct(gap)} above the comp-supported ARV ($${Math.round(a.compArv).toLocaleString('en-US')})`)
    else strengths.push('Base ARV is at or below the comp-supported ARV')
  }

  if (a.missing.length > 0) risks.push(`Underwriting incomplete — ${a.missing.length} input(s) missing`)

  return { strengths, risks }
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs.join('')
  if (xs.length === 2) return `Both ${xs[0]} and ${xs[1]}`
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
