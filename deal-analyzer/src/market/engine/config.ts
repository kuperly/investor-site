/**
 * VF-03 scoring configuration — the ONLY place market-scoring numbers live.
 *
 * Provenance tags (rendered on /markets/methodology):
 *   VF03-SPEC      stated in ValeForge VF-03 Implementation Spec v1 (docs/VF03-SPEC.md).
 *                  The spec itself calls these "initial" weights, provisional until validated.
 *   PROVISIONAL    the spec names the concept but gives no number — placeholder awaiting Guy/Ben.
 *   INTERPRETATION how a spec concept is measured with the data available.
 *
 * Thresholds marked `configurable` can be overridden by an admin on /markets/methodology;
 * every override is stored with who/when (market_config_history). Weights cannot be
 * overridden in the UI: they change only with an approved spec change.
 */
import type { ConfidenceLevel, GeoLevel } from './types'

export const MARKET_ENGINE_VERSION = '1.0.0'

export type DimensionKey = 'marketQuality' | 'opportunityDensity' | 'capitalEfficiency' | 'strategyFit'

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  marketQuality: 'Market Quality',
  opportunityDensity: 'Opportunity Density',
  capitalEfficiency: 'Capital Efficiency',
  strategyFit: 'Strategy Fit',
}

/** VF03-SPEC §3/§13 Core Market Priority weights. */
export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  marketQuality: 0.25,
  opportunityDensity: 0.3,
  capitalEfficiency: 0.25,
  strategyFit: 0.2,
}

export interface MetricUse {
  metric: string
  /** For dimensions: which way is better. For risk: which way is riskier. */
  better?: 'higher' | 'lower'
  riskier?: 'higher' | 'lower'
}

export interface ComponentDef {
  key: string
  label: string
  /** VF03-SPEC weight within its dimension. */
  weight: number
  /** INTERPRETATION: which metrics measure it (averaged, equal weights — PROVISIONAL). */
  metrics: MetricUse[]
}

const up = (metric: string): MetricUse => ({ metric, better: 'higher' })
const down = (metric: string): MetricUse => ({ metric, better: 'lower' })

export const COMPONENTS: Record<Exclude<DimensionKey, 'strategyFit'>, ComponentDef[]> = {
  // §4 Market Quality
  marketQuality: [
    { key: 'rentalDemand', label: 'Rental demand', weight: 0.2, metrics: [up('d.renter_share')] },
    { key: 'rentGrowth', label: 'Rent growth', weight: 0.15, metrics: [up('d.rent_growth_5y')] },
    { key: 'populationGrowth', label: 'Population / household growth', weight: 0.15, metrics: [up('d.population_growth_5y'), up('d.household_growth_5y')] },
    { key: 'employmentIncome', label: 'Employment / income', weight: 0.15, metrics: [down('d.unemployment_rate'), up('d.employment_growth_1y'), up('d.income_growth_5y')] },
    { key: 'housingSupply', label: 'Housing supply', weight: 0.1, metrics: [down('d.supply_vs_households_5y')] },
    { key: 'priceStabilityGrowth', label: 'Price stability / growth', weight: 0.1, metrics: [up('d.home_value_growth_5y'), up('d.hpi_growth_1y'), down('d.hpi_volatility')] },
    { key: 'liquidity', label: 'Liquidity', weight: 0.1, metrics: [down('fred.median_dom')] },
    { key: 'vacancy', label: 'Vacancy', weight: 0.05, metrics: [down('d.rental_vacancy')] },
  ],
  // §5 Opportunity Density
  opportunityDensity: [
    { key: 'distressed', label: 'Distressed', weight: 0.15, metrics: [up('opp.distressed_per_1000')] },
    { key: 'offMarket', label: 'Off-market', weight: 0.15, metrics: [up('opp.off_market_per_1000')] },
    { key: 'belowMarket', label: 'Below-market transactions', weight: 0.15, metrics: [up('opp.below_market_share')] },
    { key: 'investorAbsentee', label: 'Investor-owned / absentee', weight: 0.1, metrics: [up('opp.absentee_share'), up('opp.investor_owned_share')] },
    { key: 'equityRich', label: 'Equity-rich owners', weight: 0.1, metrics: [up('d.equity_rich_share')] },
    { key: 'taxDelinquency', label: 'Tax delinquency', weight: 0.1, metrics: [up('opp.tax_delinquent_per_1000')] },
    { key: 'foreclosure', label: 'Foreclosure', weight: 0.1, metrics: [up('opp.foreclosure_per_1000')] },
    { key: 'priceReductions', label: 'Price reductions / failed listings', weight: 0.1, metrics: [up('d.price_reduction_share')] },
    { key: 'probate', label: 'Probate / other motivated sellers', weight: 0.05, metrics: [up('opp.probate_per_1000')] },
  ],
  // §6 Capital Efficiency (market level, from Deal Analyzer runs of deal samples)
  capitalEfficiency: [
    { key: 'equityCreation', label: 'Equity creation / capital required', weight: 0.25, metrics: [up('ce.equity_per_capital')] },
    { key: 'profit', label: 'Profit / capital required', weight: 0.2, metrics: [up('ce.profit_per_capital')] },
    { key: 'capitalRecycled', label: 'Capital recycled', weight: 0.15, metrics: [up('ce.capital_recycled')] },
    { key: 'cashFlow', label: 'Cash flow / capital required', weight: 0.15, metrics: [up('ce.cash_flow_per_capital')] },
    { key: 'leverage', label: 'Leverage availability', weight: 0.1, metrics: [up('ce.leverage')] },
    { key: 'refinance', label: 'Refinance potential', weight: 0.1, metrics: [up('ce.refi_potential')] },
    { key: 'exitPaths', label: 'Multiple exit paths', weight: 0.05, metrics: [up('ce.exit_paths')] },
  ],
}

// §8 Risk factors. Each factor is the average risk percentile of its metrics (equal weights,
// PROVISIONAL); the Risk Score is the average of the known factors (PROVISIONAL).
const riskUp = (metric: string): MetricUse => ({ metric, riskier: 'higher' })
export const RISK_FACTORS: { key: string; label: string; metrics: MetricUse[] }[] = [
  { key: 'crime', label: 'Crime', metrics: [riskUp('risk.violent_crime_per_1000'), riskUp('risk.property_crime_per_1000')] },
  { key: 'propertyTaxes', label: 'Property taxes', metrics: [riskUp('d.effective_tax_rate')] },
  { key: 'insurance', label: 'Insurance', metrics: [riskUp('risk.insurance_premium')] },
  { key: 'housingAge', label: 'Housing age', metrics: [{ metric: 'acs.median_year_built', riskier: 'lower' }] },
  { key: 'rehabComplexity', label: 'Rehab complexity', metrics: [riskUp('risk.rehab_complexity_1_5')] },
  { key: 'tenantCollection', label: 'Tenant / collection', metrics: [riskUp('risk.eviction_filing_rate')] },
  { key: 'regulatory', label: 'Regulatory', metrics: [riskUp('risk.regulatory_1_5')] },
  { key: 'liquidityRisk', label: 'Liquidity', metrics: [riskUp('fred.median_dom')] },
  { key: 'supplyRisk', label: 'Supply', metrics: [riskUp('d.supply_vs_households_5y'), riskUp('d.listings_growth_1y')] },
  { key: 'economicConcentration', label: 'Economic concentration', metrics: [riskUp('risk.economic_concentration')] },
  { key: 'remoteManagement', label: 'Remote-management complexity', metrics: [riskUp('risk.remote_mgmt_1_5')] },
]

// §7 Strategy Fit. Each strategy's fit = average percentile of its evidence (PROVISIONAL);
// a `gate` metric of 0 (e.g. rent by room not allowed) makes the fit 0 (a fact, not a score).
export const STRATEGY_KEYS = [
  'brrrr',
  'buyHold',
  'fixFlip',
  'section8',
  'rentByRoom',
  'smallMultifamily',
  'offMarket',
  'creativeFinance',
  'midTermRental',
] as const
export type StrategyKey = (typeof STRATEGY_KEYS)[number]

export const STRATEGIES: Record<StrategyKey, { label: string; evidence: MetricUse[]; gate?: string; overlay?: boolean }> = {
  brrrr: { label: 'BRRRR', evidence: [up('ce.capital_recycled'), up('ce.refi_potential'), up('ce.cash_flow_per_capital'), up('ce.equity_per_capital'), up('d.renter_share')] },
  buyHold: { label: 'Buy & Hold', evidence: [up('ce.cash_flow_per_capital'), up('d.renter_share'), up('d.rent_growth_5y'), down('d.rental_vacancy'), up('d.population_growth_5y')] },
  fixFlip: { label: 'Fix & Flip', evidence: [up('ce.profit_per_capital'), down('fred.median_dom'), up('d.home_value_growth_5y'), up('d.hpi_growth_1y')] },
  section8: { label: 'Section 8 / HCV', overlay: true, evidence: [up('d.section8_rent_ratio'), up('strat.pha_payment_standard_pct'), up('d.renter_share')] },
  rentByRoom: { label: 'Rent by Room', overlay: true, gate: 'strat.rbr_allowed', evidence: [up('strat.rbr_premium'), up('d.renter_share')] },
  smallMultifamily: { label: 'Small Multifamily', evidence: [up('d.small_mf_share'), up('d.renter_share'), up('ce.cash_flow_per_capital')] },
  offMarket: { label: 'Off-Market acquisition', evidence: [up('opp.off_market_per_1000'), up('opp.absentee_share'), up('d.equity_rich_share'), up('opp.tax_delinquent_per_1000'), up('opp.probate_per_1000')] },
  creativeFinance: { label: 'Creative Finance', evidence: [up('d.equity_rich_share'), up('strat.creative_finance_1_5')] },
  midTermRental: { label: 'Mid-Term Rental', evidence: [up('strat.mtr_demand_1_5'), down('d.rental_vacancy')] },
}

export type RiskLevel = 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Critical'
export const RISK_LEVELS: RiskLevel[] = ['Low', 'Moderate', 'Elevated', 'High', 'Critical']

/** Everything an admin may override (configurable + auditable, VF-03 §12/§13). */
export interface MarketConfig {
  /** VF03-SPEC §13 — Low 1.00, Moderate 0.95, Elevated 0.85, High 0.70; Critical = BLOCK. */
  riskModifiers: { Low: number; Moderate: number; Elevated: number; High: number }
  /** PROVISIONAL — risk score (0–100, higher = riskier) upper bounds for each level. */
  riskBands: { lowBelow: number; moderateBelow: number; elevatedBelow: number }
  /** PROVISIONAL — a single risk factor at or above this percentile is called out as material. */
  materialRiskPercentile: number
  /** PROVISIONAL — confidence score per evidence level (order is VF03-SPEC §9). */
  confidenceScores: Record<ConfidenceLevel, number>
  /** PROVISIONAL — below these, the priority is shown as a range, never a precise number or rank. */
  precision: { minConfidence: number; minCompleteness: number; minPeers: number }
  /** PROVISIONAL — decision thresholds (§12). */
  decision: {
    keepMinPriority: number
    dropBelowPriority: number
    minConfidence: number
    minFreshness: number
    minRiskEvidence: number
    maxRiskLevelForKeep: 'Low' | 'Moderate' | 'Elevated' | 'High'
  }
  /** PROVISIONAL — conditional drill-down (§17). */
  drillDown: { minPriority: number; minOpportunity: number; minConfidence: number; levels: GeoLevel[] }
  /** PROVISIONAL — Strategy Fit roll-up: best, 2nd and 3rd strategy weights; "viable" fit. */
  strategyFit: { topWeights: [number, number, number]; viableFit: number; minEvidence: number }
  /** PROVISIONAL — a change this large (or any decision change) counts as significant (§16). */
  significantChange: number
  /** PROVISIONAL — confidence score labels: High ≥ high, Medium ≥ medium, else Low. */
  confidenceBands: { high: number; medium: number }
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  riskModifiers: { Low: 1.0, Moderate: 0.95, Elevated: 0.85, High: 0.7 },
  riskBands: { lowBelow: 25, moderateBelow: 45, elevatedBelow: 65 },
  materialRiskPercentile: 90,
  confidenceScores: {
    official_primary: 100,
    verified_local_commercial: 80,
    multiple_secondary: 60,
    single_secondary: 35,
    anecdotal: 15,
  },
  precision: { minConfidence: 60, minCompleteness: 0.7, minPeers: 5 },
  decision: {
    keepMinPriority: 70,
    dropBelowPriority: 40,
    minConfidence: 60,
    minFreshness: 50,
    minRiskEvidence: 0.5,
    maxRiskLevelForKeep: 'Elevated',
  },
  drillDown: { minPriority: 65, minOpportunity: 50, minConfidence: 50, levels: ['msa', 'submarket'] },
  strategyFit: { topWeights: [0.5, 0.3, 0.2], viableFit: 60, minEvidence: 0.5 },
  significantChange: 3,
  confidenceBands: { high: 75, medium: 50 },
}

/** Numeric paths an admin may override, with sane bounds. */
export const CONFIGURABLE: { path: string; label: string; min: number; max: number }[] = [
  { path: 'riskModifiers.Low', label: 'Risk modifier — Low', min: 0, max: 1 },
  { path: 'riskModifiers.Moderate', label: 'Risk modifier — Moderate', min: 0, max: 1 },
  { path: 'riskModifiers.Elevated', label: 'Risk modifier — Elevated', min: 0, max: 1 },
  { path: 'riskModifiers.High', label: 'Risk modifier — High', min: 0, max: 1 },
  { path: 'riskBands.lowBelow', label: 'Risk score: Low below', min: 0, max: 100 },
  { path: 'riskBands.moderateBelow', label: 'Risk score: Moderate below', min: 0, max: 100 },
  { path: 'riskBands.elevatedBelow', label: 'Risk score: Elevated below', min: 0, max: 100 },
  { path: 'materialRiskPercentile', label: 'Material risk factor percentile', min: 50, max: 100 },
  { path: 'precision.minConfidence', label: 'Precise score needs confidence ≥', min: 0, max: 100 },
  { path: 'precision.minCompleteness', label: 'Precise score needs completeness ≥ (0–1)', min: 0, max: 1 },
  { path: 'precision.minPeers', label: 'Minimum peers for a ranking', min: 2, max: 50 },
  { path: 'decision.keepMinPriority', label: 'KEEP: priority ≥', min: 0, max: 100 },
  { path: 'decision.dropBelowPriority', label: 'DROP: priority <', min: 0, max: 100 },
  { path: 'decision.minConfidence', label: 'KEEP: confidence ≥', min: 0, max: 100 },
  { path: 'decision.minFreshness', label: 'KEEP: freshness ≥', min: 0, max: 100 },
  { path: 'decision.minRiskEvidence', label: 'KEEP: risk evidence ≥ (0–1)', min: 0, max: 1 },
  { path: 'drillDown.minPriority', label: 'Drill-down: priority ≥', min: 0, max: 100 },
  { path: 'drillDown.minOpportunity', label: 'Drill-down: Opportunity Density ≥', min: 0, max: 100 },
  { path: 'drillDown.minConfidence', label: 'Drill-down: confidence ≥', min: 0, max: 100 },
  { path: 'strategyFit.viableFit', label: 'Strategy counted as viable at fit ≥', min: 0, max: 100 },
  { path: 'strategyFit.minEvidence', label: 'Strategy fit needs evidence ≥ (0–1)', min: 0, max: 1 },
  { path: 'significantChange', label: 'Significant score change (points)', min: 0, max: 50 },
]

export type ConfigOverrides = Record<string, number>

function setPath(obj: Record<string, unknown>, path: string, v: number) {
  const parts = path.split('.')
  let o = obj
  for (const p of parts.slice(0, -1)) o = o[p] as Record<string, unknown>
  o[parts[parts.length - 1]] = v
}

export function getPath(obj: unknown, path: string): number {
  return path.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj) as number
}

/** Applies validated overrides; unknown paths and out-of-range values are ignored (and reported). */
export function resolveConfig(overrides: ConfigOverrides = {}): { config: MarketConfig; rejected: string[] } {
  const config = structuredClone(DEFAULT_MARKET_CONFIG) as MarketConfig
  const rejected: string[] = []
  for (const [path, v] of Object.entries(overrides)) {
    const c = CONFIGURABLE.find((x) => x.path === path)
    if (!c || typeof v !== 'number' || !Number.isFinite(v) || v < c.min || v > c.max) {
      rejected.push(path)
      continue
    }
    setPath(config as unknown as Record<string, unknown>, path, v)
  }
  return { config, rejected }
}

export interface MarketMethodologyRule {
  area: string
  rule: string
  source: 'VF03-SPEC' | 'PROVISIONAL' | 'INTERPRETATION'
}

export const MARKET_METHODOLOGY: MarketMethodologyRule[] = [
  { area: 'Core Market Priority', rule: 'Market Quality × 25% + Opportunity Density × 30% + Capital Efficiency × 25% + Strategy Fit × 20%, then × the risk modifier', source: 'VF03-SPEC' },
  { area: 'Risk modifier', rule: 'Low 1.00 · Moderate 0.95 · Elevated 0.85 · High 0.70 · Critical = BLOCK (configurable, provisional until validated)', source: 'VF03-SPEC' },
  { area: 'Risk levels', rule: 'Risk score < 25 Low, < 45 Moderate, < 65 Elevated, otherwise High. Critical only from a critical hard risk flag. A high hard flag raises the level to at least High', source: 'PROVISIONAL' },
  { area: 'Normalization', rule: 'Every metric becomes a 0–100 percentile among its peer group (same level; ZIPs/submarkets within the same parent). Ties share the mid-rank. Lower-is-better metrics are inverted. Raw values are always kept and shown', source: 'INTERPRETATION' },
  { area: 'Normalization · ordinal & flags', rule: '1–5 ratings and yes/no flags use their fixed scale ((value − min) ÷ (max − min) × 100), not peers', source: 'INTERPRETATION' },
  { area: 'Components', rule: 'A component is the average of the percentiles of its known metrics (equal weights). Component weights inside each dimension are the spec’s initial weights', source: 'PROVISIONAL' },
  { area: 'Partial evidence', rule: 'UNKNOWN is never 0. Each aggregate reports point (known parts, renormalized), low (unknowns at 0), high (unknowns at 100) and completeness. Missing data lowers confidence, not attractiveness', source: 'INTERPRETATION' },
  { area: 'False precision', rule: 'When confidence < 60, completeness < 70% or the peer group has fewer than 5 members, the priority is shown as a low–high range and the geography is not ranked', source: 'PROVISIONAL' },
  { area: 'Confidence', rule: 'Evidence level scores: official/primary 100 · verified local/commercial 80 · multiple secondary 60 · single secondary 35 · anecdotal 15. Unsupported assumptions are rejected. Geography confidence = weight-averaged evidence score over every expected component (missing = 0)', source: 'PROVISIONAL' },
  { area: 'Confidence · ACS margins', rule: 'ACS coefficient of variation (MOE ÷ 1.645 ÷ estimate): ≤ 12% keeps the level, 12–40% lowers it one level, > 40% two levels. A derived metric takes its weakest input’s level', source: 'INTERPRETATION' },
  { area: 'Freshness', rule: 'Per-source policies (ACS fresh 27 months after the period end, stale at 39; HUD FMR 15/27; BLS monthly 4/13; Realtor.com 3/13; FHFA 7/16; manual 12/24; deal samples 6/18). Freshness score = weight-average over the evidence present', source: 'INTERPRETATION' },
  { area: 'Market Quality', rule: 'Rental demand 20 · Rent growth 15 · Population/household growth 15 · Employment/income 15 · Housing supply 10 · Price stability/growth 10 · Liquidity 10 · Vacancy 5', source: 'VF03-SPEC' },
  { area: 'Market Quality · measures', rule: 'Rental demand = renter share. Rent growth = ACS median gross rent, 5-year change between non-overlapping 5-year releases. Population = population + household 5-year growth. Employment/income = unemployment (BLS, else ACS; lower better), 12-month employment growth (BLS), income 5-year growth (nominal). Housing supply = housing-unit growth minus household growth (lower better). Price = home value 5-year growth, HPI 12-month growth, HPI volatility (lower better). Liquidity = median days on market (lower better). Vacancy = rental vacancy rate (lower better)', source: 'INTERPRETATION' },
  { area: 'Opportunity Density', rule: 'Distressed 15 · Off-market 15 · Below-market 15 · Investor/absentee 10 · Equity-rich 10 · Tax delinquency 10 · Foreclosure 10 · Price reductions 10 · Probate 5', source: 'VF03-SPEC' },
  { area: 'Opportunity Density · measures', rule: 'Equity-rich = share of owner-occupied units without a mortgage (ACS proxy). Price reductions = price-reduced listings ÷ active listings. All other components are entered from local records with their source and confidence; anecdotal claims are recorded as Anecdotal', source: 'INTERPRETATION' },
  { area: 'Capital Efficiency', rule: 'Equity/capital 25 · Profit/capital 20 · Capital recycled 15 · Cash flow/capital 15 · Leverage 10 · Refinance potential 10 · Exit paths 5', source: 'VF03-SPEC' },
  { area: 'Capital Efficiency · measures', rule: 'Each deal sample (market assumption set or an actual deal) is underwritten by the Deal Analyzer engine (analyzeDeal) — no formula is duplicated. Per geography the median of each measure across its samples is used: equity ÷ total cash invested, flip ROI, capital recycled %, post-refi cash flow ÷ total cash invested, acquisition loan ÷ all-in, refi loan ÷ all-in, viable exits among BRRRR/Hold/Flip', source: 'INTERPRETATION' },
  { area: 'Strategy Fit', rule: 'Nine strategies scored separately (0–100) from their evidence; Section 8 and Rent by Room are overlays and never enter Market Quality. Rent by Room is 0 where it is not allowed', source: 'VF03-SPEC' },
  { area: 'Strategy Fit · roll-up', rule: 'Not an average: best strategy × 50% + 2nd × 30% + 3rd × 20%, so a market with several strong strategies scores above a one-strategy market. A strategy needs ≥ 50% of its evidence to be scored', source: 'PROVISIONAL' },
  { area: 'Risk', rule: 'Eleven factors tracked separately; Risk Score = average of known factor percentiles. Any factor ≥ the 90th percentile is listed as a material risk. Critical hard flags BLOCK the priority', source: 'PROVISIONAL' },
  { area: 'Decision', rule: 'DROP: critical hard flag, or (with confidence ≥ 60) priority < 40 or even the optimistic upper bound < 40. Weak-looking markets on low-confidence evidence stay WATCH. KEEP: priority ≥ 70, confidence ≥ 60, freshness ≥ 50, risk evidence ≥ 50%, risk ≤ Elevated, peers ≥ 5. DRILL_DOWN: MSA/submarket meeting the drill-down criteria and not yet drilled. Otherwise WATCH. Never BUY/PASS for markets', source: 'PROVISIONAL' },
  { area: 'Drill-down', rule: 'Children (submarkets, ZIPs) are analyzed only after the parent is promoted. Promotion needs priority ≥ 65, Opportunity Density ≥ 50, confidence ≥ 50 and no blocking risk; the reasons are stored with the promotion', source: 'PROVISIONAL' },
  { area: 'Change detection', rule: 'Each evaluation is stored as a snapshot. A change is explained as priority points per dimension (and per component), the risk-modifier effect and the remainder from evidence coverage. ≥ 3 points or a decision change is significant', source: 'INTERPRETATION' },
  { area: 'Avatar fit', rule: 'Share of housing units matching the avatar = type share × bedroom share × year-built share × value share (ACS distributions; independence assumed; uniform within bins; "1939 or earlier" treated as 1900–1939; value compared with the avatar ARV range, else purchase range). Estimated avatar universe = housing units × that share', source: 'INTERPRETATION' },
  { area: 'Hand-off', rule: 'A candidate becomes a Deal Analyzer deal with property facts and asking price only. ARV, rehab and rent estimates go to the deal notes with their source — the Deal Analyzer stays the source of truth for underwriting', source: 'INTERPRETATION' },
]
