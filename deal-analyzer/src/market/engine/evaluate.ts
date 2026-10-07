/**
 * VF-03 market evaluation — the single entry point (evaluateMarkets).
 *
 * Takes every geography of one evaluation run (observations, deal samples, hard risk flags)
 * and returns, per geography, the seven independent dimensions, the risk-adjusted Core Market
 * Priority with honest bounds, the KEEP / WATCH / DROP / DRILL_DOWN decision with its reasons,
 * and the drill-down state. Deterministic: same inputs + same date → same result.
 */
import { capitalEvidence, type SampleInput, type SampleResult } from './capital'
import {
  COMPONENTS,
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  MARKET_ENGINE_VERSION,
  RISK_FACTORS,
  RISK_LEVELS,
  STRATEGIES,
  STRATEGY_KEYS,
  type DimensionKey,
  type MarketConfig,
  type MetricUse,
  type RiskLevel,
  type StrategyKey,
} from './config'
import { deriveEvidence, type Evidence, type EvidenceMap } from './derive'
import { FRESHNESS_POLICIES, freshness, type FreshnessResult } from './freshness'
import { METRICS, metricLabel } from './metrics'
import type { Geography, HardRiskFlag, Observation, Partial100, Score } from './types'

export interface GeoInput {
  geo: Geography
  observations: Observation[]
  samples: SampleInput[]
  hardFlags: HardRiskFlag[]
  /** The geography has been promoted for drill-down already (its children are being analyzed). */
  promoted: boolean
  /** Peer group override (default peerKey(geo)); e.g. ZIPs of one MSA across its submarkets. */
  peerGroup?: string
}

export interface MetricScore {
  metric: string
  label: string
  /** 0–100. For dimensions: higher = better. For risk: higher = riskier. */
  score: number
  method: 'peer_percentile' | 'fixed_scale'
  peers: number
  evidence: Evidence
  freshness: FreshnessResult
  confidenceScore: number
}

export interface ComponentResult {
  key: string
  label: string
  weight: number
  score: Score
  metrics: MetricScore[]
  missing: string[]
  confidence: number
}

export interface DimensionResult extends Partial100 {
  key: DimensionKey
  label: string
  /** Evidence quality, 0–100 (missing components count as 0). */
  confidence: number
  /** Freshness of the evidence present, 0–100 (null if none). */
  freshness: Score
  components: ComponentResult[]
}

export interface StrategyFitResult {
  key: StrategyKey
  label: string
  overlay: boolean
  /** null = insufficient evidence. */
  fit: Score
  completeness: number
  gateBlocked: boolean
  evidence: MetricScore[]
  missing: string[]
  confidence: number
}

export interface RiskFactorResult {
  key: string
  label: string
  score: Score
  metrics: MetricScore[]
  missing: string[]
  material: boolean
}

export interface RiskResult {
  /** Average of known factors (0–100, higher = riskier); null if none known. */
  score: Score
  /** Unknown factors at 0 / at 100. */
  best: number
  worst: number
  completeness: number
  level: RiskLevel | null
  modifier: { point: number; low: number; high: number }
  blocked: boolean
  factors: RiskFactorResult[]
  hardFlags: HardRiskFlag[]
  material: string[]
}

export type DecisionState = 'KEEP' | 'WATCH' | 'DROP' | 'DRILL_DOWN'

export interface Check {
  label: string
  pass: boolean | null
  detail: string
}

export interface MarketEvaluation {
  geoId: string
  geoName: string
  level: Geography['level']
  engineVersion: string
  evaluationDate: string
  peerGroup: { key: string; size: number }
  dimensions: Record<DimensionKey, DimensionResult>
  strategies: StrategyFitResult[]
  viableStrategies: StrategyKey[]
  risk: RiskResult
  confidence: { score: number; label: 'High' | 'Medium' | 'Low' }
  freshness: { score: Score; stale: string[]; aging: string[] }
  priority: Partial100 & { blocked: boolean; display: 'precise' | 'range'; rank: number | null; core: Partial100 }
  decision: { state: DecisionState; reasons: string[] }
  drillDown: { state: 'promoted' | 'eligible' | 'not_eligible' | 'not_applicable'; checks: Check[] }
  evidence: EvidenceMap
  samples: Pick<SampleResult, 'values' | 'incomplete' | 'recommendation' | 'missing'>[]
}

const round1 = (x: number) => Math.round(x * 10) / 10
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** Peer group: same level; below MSA level also the same parent (ZIPs ranked within their market). */
export const peerKey = (g: Geography) => (g.level === 'country' || g.level === 'msa' ? g.level : `${g.level}@${g.parentId ?? 'none'}`)

/** Mid-rank percentile of `v` among `values` (which include v), 0–100. One value → 50. */
export function percentile(v: number, values: number[]): number {
  if (values.length <= 1) return 50
  const less = values.filter((x) => x < v).length
  const equal = values.filter((x) => x === v).length
  return (100 * (less + (equal - 1) / 2)) / (values.length - 1)
}

/** Weighted roll-up with honest bounds: unknown parts are left out of the point, 0 / 100 in the bounds. */
export function partial(parts: { weight: number; score: Score }[]): Partial100 {
  const total = parts.reduce((s, p) => s + p.weight, 0)
  const known = parts.filter((p) => p.score !== null)
  const kw = known.reduce((s, p) => s + p.weight, 0)
  const ks = known.reduce((s, p) => s + p.weight * (p.score as number), 0)
  if (total === 0) return { point: null, low: 0, high: 100, completeness: 0 }
  return {
    point: kw > 0 ? round1(ks / kw) : null,
    low: round1(ks / total),
    high: round1((ks + (total - kw) * 100) / total),
    completeness: Math.round((kw / total) * 1000) / 1000,
  }
}

export function riskLevelFor(score: number, cfg: MarketConfig): Exclude<RiskLevel, 'Critical'> {
  const b = cfg.riskBands
  return score < b.lowBelow ? 'Low' : score < b.moderateBelow ? 'Moderate' : score < b.elevatedBelow ? 'Elevated' : 'High'
}

const maxLevel = (a: RiskLevel, b: RiskLevel): RiskLevel => (RISK_LEVELS.indexOf(a) >= RISK_LEVELS.indexOf(b) ? a : b)

export function evaluateMarkets(geos: GeoInput[], cfg: MarketConfig, evaluationDate: string): MarketEvaluation[] {
  // 1. Evidence per geography: derived observations + Deal Analyzer capital-efficiency samples.
  const prepared = geos.map((g) => {
    const { evidence: ce, results } = capitalEvidence(g.samples)
    return { input: g, evidence: { ...deriveEvidence(g.observations), ...ce }, sampleResults: results }
  })

  // 2. Peer values per (peer group, metric) for percentile normalization.
  const keyOf = (g: GeoInput) => g.peerGroup ?? peerKey(g.geo)
  const groups = new Map<string, typeof prepared>()
  for (const p of prepared) groups.set(keyOf(p.input), [...(groups.get(keyOf(p.input)) ?? []), p])
  const peerValues = (group: string, metric: string) =>
    (groups.get(group) ?? []).map((p) => p.evidence[metric]?.value).filter((v): v is number => v !== undefined)

  const evaluations = prepared.map((p) => evaluateOne(p.input, p.evidence, p.sampleResults, keyOf(p.input), peerValues, groups.get(keyOf(p.input))!.length, cfg, evaluationDate))

  // 3. Rank only geographies whose priority is precise (no false-precision ranking).
  for (const [key] of groups) {
    const ranked = evaluations
      .filter((e) => e.peerGroup.key === key && e.priority.display === 'precise' && e.priority.point !== null && !e.priority.blocked)
      .sort((a, b) => (b.priority.point as number) - (a.priority.point as number))
    ranked.forEach((e, i) => (e.priority.rank = i + 1))
  }
  return evaluations
}

function evaluateOne(
  g: GeoInput,
  evidence: EvidenceMap,
  sampleResults: SampleResult[],
  group: string,
  peerValues: (group: string, metric: string) => number[],
  groupSize: number,
  cfg: MarketConfig,
  evaluationDate: string,
): MarketEvaluation {
  const score = (use: MetricUse): MetricScore | null => {
    const ev = evidence[use.metric]
    if (!ev) return null
    const def = METRICS[use.metric]
    const peers = peerValues(group, use.metric)
    let s: number
    let method: MetricScore['method']
    if (def?.scale) {
      s = Math.max(0, Math.min(100, ((ev.value - def.scale.min) / (def.scale.max - def.scale.min)) * 100))
      method = 'fixed_scale'
    } else {
      s = percentile(ev.value, peers)
      method = 'peer_percentile'
    }
    const invert = use.better === 'lower' || use.riskier === 'lower'
    return {
      metric: use.metric,
      label: metricLabel(use.metric),
      score: round1(invert ? 100 - s : s),
      method,
      peers: peers.length,
      evidence: ev,
      freshness: freshness(ev.asOf, evaluationDate, FRESHNESS_POLICIES[def?.freshness ?? 'manual']),
      confidenceScore: cfg.confidenceScores[ev.confidence],
    }
  }
  const scored = (uses: MetricUse[]) => {
    const metrics = uses.map(score).filter((m): m is MetricScore => m !== null)
    const missing = uses.filter((u) => !evidence[u.metric]).map((u) => u.metric)
    return { metrics, missing, score: metrics.length ? round1(mean(metrics.map((m) => m.score))) : null, confidence: metrics.length ? mean(metrics.map((m) => m.confidenceScore)) : 0 }
  }

  const dimension = (key: Exclude<DimensionKey, 'strategyFit'>): DimensionResult => {
    const components: ComponentResult[] = COMPONENTS[key].map((c) => ({ key: c.key, label: c.label, weight: c.weight, ...scored(c.metrics) }))
    return {
      key,
      label: DIMENSION_LABELS[key],
      ...partial(components),
      confidence: round1(components.reduce((s, c) => s + c.weight * c.confidence, 0) / components.reduce((s, c) => s + c.weight, 0)),
      freshness: freshnessOf(components.flatMap((c) => c.metrics.map((m) => ({ weight: c.weight / Math.max(1, c.metrics.length), m })))),
      components,
    }
  }

  // ---- Strategy Fit (§7) ----
  const strategies: StrategyFitResult[] = STRATEGY_KEYS.map((key) => {
    const def = STRATEGIES[key]
    const s = scored(def.evidence)
    const gate = def.gate ? evidence[def.gate] : undefined
    const gateBlocked = gate !== undefined && gate.value === 0
    // A gate (e.g. is rent by room legal here?) must be known before the strategy can be scored.
    const gateUnknown = def.gate !== undefined && gate === undefined
    const completeness = def.evidence.length ? s.metrics.length / def.evidence.length : 0
    return {
      key,
      label: def.label,
      overlay: Boolean(def.overlay),
      fit: gateBlocked ? 0 : gateUnknown ? null : completeness >= cfg.strategyFit.minEvidence ? s.score : null,
      completeness: gateBlocked ? 1 : Math.round(completeness * 1000) / 1000,
      gateBlocked,
      evidence: s.metrics,
      missing: gateUnknown ? [def.gate!, ...s.missing] : s.missing,
      confidence: gateBlocked ? cfg.confidenceScores[gate!.confidence] : s.confidence,
    }
  })
  const known = strategies.filter((s) => s.fit !== null).sort((a, b) => (b.fit as number) - (a.fit as number))
  const slots = cfg.strategyFit.topWeights.map((w, i) => ({ weight: w, score: known[i]?.fit ?? null, conf: known[i]?.confidence ?? 0, strat: known[i] }))
  const sfPartial = partial(slots)
  const strategyFit: DimensionResult = {
    key: 'strategyFit',
    label: DIMENSION_LABELS.strategyFit,
    ...sfPartial,
    confidence: round1(slots.reduce((s, x) => s + x.weight * x.conf, 0) / slots.reduce((s, x) => s + x.weight, 0)),
    freshness: freshnessOf(slots.flatMap((x) => (x.strat ? x.strat.evidence.map((m) => ({ weight: x.weight / Math.max(1, x.strat!.evidence.length), m })) : []))),
    components: slots.map((x, i) => ({
      key: `top${i + 1}`,
      label: x.strat ? `#${i + 1}: ${x.strat.label}` : `#${i + 1}: not enough evidence`,
      weight: x.weight,
      score: x.score,
      metrics: x.strat?.evidence ?? [],
      missing: x.strat?.missing ?? [],
      confidence: x.conf,
    })),
  }
  const viableStrategies = strategies.filter((s) => s.fit !== null && s.fit >= cfg.strategyFit.viableFit).map((s) => s.key)

  const dimensions: Record<DimensionKey, DimensionResult> = {
    marketQuality: dimension('marketQuality'),
    opportunityDensity: dimension('opportunityDensity'),
    capitalEfficiency: dimension('capitalEfficiency'),
    strategyFit,
  }

  // ---- Risk (§8): tracked separately, applied as a modifier ----
  const factors: RiskFactorResult[] = RISK_FACTORS.map((f) => {
    const s = scored(f.metrics)
    return { key: f.key, label: f.label, score: s.score, metrics: s.metrics, missing: s.missing, material: s.score !== null && s.score >= cfg.materialRiskPercentile }
  })
  const knownF = factors.filter((f) => f.score !== null).map((f) => f.score as number)
  const n = factors.length
  const riskScore = knownF.length ? round1(mean(knownF)) : null
  const best = round1(knownF.reduce((s, x) => s + x, 0) / n)
  const worst = round1((knownF.reduce((s, x) => s + x, 0) + (n - knownF.length) * 100) / n)
  const critical = g.hardFlags.some((f) => f.severity === 'critical')
  const highFlag = g.hardFlags.some((f) => f.severity === 'high')
  const levelOf = (s: number | null): RiskLevel | null => {
    if (critical) return 'Critical'
    const base = s === null ? null : riskLevelFor(s, cfg)
    if (highFlag) return base ? maxLevel(base, 'High') : 'High'
    return base
  }
  const mod = (l: RiskLevel | null) => (l === null || l === 'Critical' ? 1 : cfg.riskModifiers[l])
  const level = levelOf(riskScore)
  const risk: RiskResult = {
    score: riskScore,
    best,
    worst,
    completeness: Math.round((knownF.length / n) * 1000) / 1000,
    level,
    modifier: {
      point: mod(level),
      low: Math.min(mod(levelOf(worst)), mod(level)),
      high: Math.max(mod(levelOf(best)), mod(level)),
    },
    blocked: critical,
    factors,
    hardFlags: g.hardFlags,
    material: factors.filter((f) => f.material).map((f) => f.label),
  }

  // ---- Confidence & freshness (§9): evidence quality, not attractiveness ----
  const coreKeys = Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]
  const confScore = round1(coreKeys.reduce((s, k) => s + DIMENSION_WEIGHTS[k] * dimensions[k].confidence, 0))
  const confidence = {
    score: confScore,
    label: (confScore >= cfg.confidenceBands.high ? 'High' : confScore >= cfg.confidenceBands.medium ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
  }
  const allMetrics = [...coreKeys.flatMap((k) => dimensions[k].components.flatMap((c) => c.metrics)), ...factors.flatMap((f) => f.metrics)]
  const fresh = freshnessOf(
    coreKeys.flatMap((k) =>
      dimensions[k].components.flatMap((c) => c.metrics.map((m) => ({ weight: (DIMENSION_WEIGHTS[k] * c.weight) / Math.max(1, c.metrics.length), m }))),
    ),
  )
  const uniq = (xs: string[]) => [...new Set(xs)]
  const freshnessSummary = {
    score: fresh,
    stale: uniq(allMetrics.filter((m) => m.freshness.status === 'stale').map((m) => m.metric)),
    aging: uniq(allMetrics.filter((m) => m.freshness.status === 'aging').map((m) => m.metric)),
  }

  // ---- Core Market Priority (§13) ----
  const core = partial(coreKeys.map((k) => ({ weight: DIMENSION_WEIGHTS[k], score: dimensions[k].point })))
  // Bounds use each dimension's own bounds, not just "unknown dimension = 0/100".
  const wsum = coreKeys.reduce((s, k) => s + DIMENSION_WEIGHTS[k], 0)
  core.low = round1(coreKeys.reduce((s, k) => s + DIMENSION_WEIGHTS[k] * dimensions[k].low, 0) / wsum)
  core.high = round1(coreKeys.reduce((s, k) => s + DIMENSION_WEIGHTS[k] * dimensions[k].high, 0) / wsum)
  core.completeness = Math.round((coreKeys.reduce((s, k) => s + DIMENSION_WEIGHTS[k] * dimensions[k].completeness, 0) / wsum) * 1000) / 1000
  const priority: MarketEvaluation['priority'] = {
    point: risk.blocked || core.point === null ? null : round1(core.point * risk.modifier.point),
    low: risk.blocked ? 0 : round1(core.low * risk.modifier.low),
    high: risk.blocked ? 0 : round1(core.high * risk.modifier.high),
    completeness: core.completeness,
    blocked: risk.blocked,
    display:
      confScore >= cfg.precision.minConfidence && core.completeness >= cfg.precision.minCompleteness && groupSize >= cfg.precision.minPeers
        ? 'precise'
        : 'range',
    rank: null,
    core,
  }

  // ---- Drill-down (§17) ----
  const drillable = cfg.drillDown.levels.includes(g.geo.level)
  const opp = dimensions.opportunityDensity
  const fmt = (x: Score) => (x === null ? 'UNKNOWN' : String(x))
  const checks: Check[] = drillable
    ? [
        { label: 'No blocking (critical) risk', pass: !risk.blocked, detail: risk.blocked ? 'A critical hard risk flag is set' : 'None' },
        { label: `Priority ≥ ${cfg.drillDown.minPriority}`, pass: priority.point === null ? null : priority.point >= cfg.drillDown.minPriority, detail: fmt(priority.point) },
        { label: `Opportunity Density ≥ ${cfg.drillDown.minOpportunity}`, pass: opp.point === null ? null : opp.point >= cfg.drillDown.minOpportunity, detail: fmt(opp.point) },
        { label: `Confidence ≥ ${cfg.drillDown.minConfidence}`, pass: confScore >= cfg.drillDown.minConfidence, detail: String(confScore) },
      ]
    : []
  const eligible = drillable && checks.every((c) => c.pass === true)
  const drillDown: MarketEvaluation['drillDown'] = {
    state: !drillable ? 'not_applicable' : g.promoted ? 'promoted' : eligible ? 'eligible' : 'not_eligible',
    checks,
  }

  // ---- Decision (§12): never BUY/PASS for markets ----
  const d = cfg.decision
  const reasons: string[] = []
  let state: DecisionState
  const riskOk = level !== null && RISK_LEVELS.indexOf(level) <= RISK_LEVELS.indexOf(d.maxRiskLevelForKeep)
  if (risk.blocked) {
    state = 'DROP'
    reasons.push(`Critical hard risk: ${g.hardFlags.filter((f) => f.severity === 'critical').map((f) => `${f.category} — ${f.reason}`).join('; ')}`)
  } else if (priority.high < d.dropBelowPriority && confScore >= d.minConfidence) {
    // Weak even if every unknown turned out best — and the known evidence is reliable enough to say so.
    state = 'DROP'
    reasons.push(`Even with every unknown at its best, priority would be ${priority.high} (< ${d.dropBelowPriority})`)
  } else if (priority.point !== null && priority.point < d.dropBelowPriority && confScore >= d.minConfidence) {
    state = 'DROP'
    reasons.push(`Weak economics/opportunity on sufficient evidence: priority ${priority.point} (< ${d.dropBelowPriority}), confidence ${confScore}`)
  } else {
    if (priority.point !== null && priority.point < d.dropBelowPriority)
      reasons.push(`Looks weak (priority ${priority.point}) but the evidence is too weak to drop it: confidence ${confScore} < ${d.minConfidence}`)
    const keepChecks: [boolean, string][] = [
      [priority.point !== null && priority.point >= d.keepMinPriority, `priority ${fmt(priority.point)} ${priority.point !== null && priority.point >= d.keepMinPriority ? '≥' : '<'} ${d.keepMinPriority}`],
      [confScore >= d.minConfidence, `confidence ${confScore} ${confScore >= d.minConfidence ? '≥' : '<'} ${d.minConfidence}`],
      [fresh !== null && fresh >= d.minFreshness, `freshness ${fmt(fresh)} ${fresh !== null && fresh >= d.minFreshness ? '≥' : '<'} ${d.minFreshness}`],
      [risk.completeness >= d.minRiskEvidence, `risk evidence ${Math.round(risk.completeness * 100)}% ${risk.completeness >= d.minRiskEvidence ? '≥' : '<'} ${Math.round(d.minRiskEvidence * 100)}%`],
      [riskOk, `risk level ${level ?? 'UNKNOWN'} ${riskOk ? 'within' : 'above'} ${d.maxRiskLevelForKeep}`],
      [groupSize >= cfg.precision.minPeers, `${groupSize} peer${groupSize === 1 ? '' : 's'} ${groupSize >= cfg.precision.minPeers ? '≥' : '<'} ${cfg.precision.minPeers}`],
    ]
    const strong = keepChecks.every(([ok]) => ok)
    if (drillable && !g.promoted && eligible) {
      state = 'DRILL_DOWN'
      reasons.push('Strong parent-level signal: ' + checks.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join(', '))
    } else if (strong) {
      state = 'KEEP'
      reasons.push(...keepChecks.map(([, t]) => t))
    } else {
      state = 'WATCH'
      reasons.push(`Not yet KEEP: ${keepChecks.filter(([ok]) => !ok).map(([, t]) => t).join('; ')}`)
    }
  }
  if (risk.material.length) reasons.push(`Material risk: ${risk.material.join(', ')}`)
  if (g.hardFlags.some((f) => f.severity === 'high')) reasons.push(`High hard risk flag: ${g.hardFlags.filter((f) => f.severity === 'high').map((f) => f.category).join(', ')}`)

  return {
    geoId: g.geo.id,
    geoName: g.geo.name,
    level: g.geo.level,
    engineVersion: MARKET_ENGINE_VERSION,
    evaluationDate,
    peerGroup: { key: group, size: groupSize },
    dimensions,
    strategies,
    viableStrategies,
    risk,
    confidence,
    freshness: freshnessSummary,
    priority,
    decision: { state, reasons },
    drillDown,
    evidence,
    samples: sampleResults.map((r) => ({ values: r.values, incomplete: r.incomplete, recommendation: r.recommendation, missing: r.missing })),
  }
}

function freshnessOf(items: { weight: number; m: MetricScore }[]): Score {
  const w = items.reduce((s, x) => s + x.weight, 0)
  if (w === 0) return null
  return round1(items.reduce((s, x) => s + x.weight * x.m.freshness.score, 0) / w)
}
