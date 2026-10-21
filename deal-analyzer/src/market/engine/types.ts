/**
 * VF-03 Market Intelligence — core types.
 *
 * Pure TypeScript, no I/O. Separate from the Deal Analyzer engine (src/engine); the only
 * crossing is the DealInputs contract and analyzeDeal() (see boundary.test.ts).
 *
 * UNKNOWN is never zero: a metric without an accepted observation is simply absent, and
 * every aggregate reports how complete it is.
 */

export const GEO_LEVELS = ['country', 'msa', 'submarket', 'zcta', 'tract', 'block_group', 'micro'] as const
export type GeoLevel = (typeof GEO_LEVELS)[number]

export const GEO_LEVEL_LABELS: Record<GeoLevel, string> = {
  country: 'Country',
  msa: 'MSA / Market',
  submarket: 'Submarket',
  zcta: 'ZIP (ZCTA)',
  tract: 'Census tract',
  block_group: 'Block group',
  micro: 'Micro cluster',
}

/** Allowed parent level for each level (structured hierarchy, VF-03 §10). */
export const PARENT_LEVELS: Record<GeoLevel, GeoLevel[]> = {
  country: [],
  msa: ['country'],
  submarket: ['msa'],
  zcta: ['submarket', 'msa'],
  tract: ['zcta'],
  block_group: ['tract'],
  micro: ['block_group', 'tract', 'zcta'],
}

export interface Geography {
  /** Machine key, e.g. "cbsa:19100", "zcta:75201", "submarket:<uuid>". Never a neighborhood name. */
  id: string
  level: GeoLevel
  /** Official code (CBSA, ZCTA5, tract GEOID); null for user-defined submarkets / micro clusters. */
  code: string | null
  /** Display only. */
  name: string
  parentId: string | null
  /** Two-letter state (primary state for multi-state MSAs). */
  state: string | null
}

/**
 * Evidence quality, best first (VF-03 §9). "Unsupported assumption" is not a level:
 * such values are rejected at validation.
 */
export const CONFIDENCE_LEVELS = [
  'official_primary',
  'verified_local_commercial',
  'multiple_secondary',
  'single_secondary',
  'anecdotal',
] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  official_primary: 'Official / primary',
  verified_local_commercial: 'Verified local or commercial',
  multiple_secondary: 'Multiple secondary sources',
  single_secondary: 'Single secondary source',
  anecdotal: 'Anecdotal',
}

export interface DistributionBin {
  /** Machine key, e.g. "1_detached", "2", "3_4", "b3" (3 bedrooms). */
  key: string
  label: string
  /** Inclusive lower bound (null = open). */
  lo: number | null
  /** Exclusive upper bound (null = open). */
  hi: number | null
  count: number
}

/** One stored observation of a metric for a geography. Observations are never overwritten. */
export interface Observation {
  id?: string
  geoId: string
  metric: string
  value: number
  unit: string
  source: string
  sourceUrl: string | null
  /** The date the value describes (YYYY-MM-DD), e.g. the end of an ACS 5-year period. */
  asOf: string
  /** When ValeForge retrieved it (ISO timestamp). */
  retrievedAt: string
  confidence: ConfidenceLevel
  methodology: string
  /** ACS margin of error (90%), when the source publishes one. */
  moe?: number | null
  /** Distribution metrics (e.g. year built) carry their bins. */
  detail?: { bins: DistributionBin[] } | null
}

export type Direction = 'higher_better' | 'lower_better'

export const HARD_FLAG_SEVERITIES = ['critical', 'high'] as const
export type HardFlagSeverity = (typeof HARD_FLAG_SEVERITIES)[number]

export interface HardRiskFlag {
  id: string
  geoId: string
  severity: HardFlagSeverity
  category: string
  reason: string
  source: string
  sourceUrl: string | null
}

/** A capital-efficiency sample: one DealInputs scenario underwritten by the Deal Analyzer. */
export interface DealSample {
  id: string
  label: string
  kind: 'assumption' | 'deal'
  confidence: ConfidenceLevel
  source: string
  asOf: string
}

export type Score = number | null

/** A 0–100 aggregate built from what is known, with its honest bounds. */
export interface Partial100 {
  /** Weighted average over known parts (renormalized); null when nothing is known. */
  point: Score
  /** Every unknown part scored 0. */
  low: number
  /** Every unknown part scored 100. */
  high: number
  /** Share of the weight that is known, 0–1. */
  completeness: number
}
