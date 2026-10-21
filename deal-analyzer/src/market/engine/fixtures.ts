/** Test fixtures for the VF-03 engine (synthetic — never shown as real market data). */
import { COMPONENTS, RISK_FACTORS, STRATEGIES, type MetricUse } from './config'
import type { GeoInput } from './evaluate'
import { METRICS } from './metrics'
import type { ConfidenceLevel, Geography, HardRiskFlag, Observation } from './types'

export const EVAL_DATE = '2026-10-07'

export function geo(id: string, level: Geography['level'] = 'msa', parentId: string | null = null): Geography {
  return { id, level, code: id.split(':')[1] ?? null, name: `Geo ${id}`, parentId, state: 'TX' }
}

export function obs(geoId: string, metric: string, value: number, asOf = '2026-09-01', extra: Partial<Observation> = {}): Observation {
  return {
    geoId,
    metric,
    value,
    unit: METRICS[metric]?.unit ?? 'ratio',
    source: 'Synthetic test source',
    sourceUrl: null,
    asOf,
    retrievedAt: `${EVAL_DATE}T00:00:00Z`,
    confidence: 'official_primary',
    methodology: 'test',
    ...extra,
  }
}

const UNIT_SCALE: Record<string, [number, number]> = {
  ratio: [0.02, 0.03],
  usd: [900, 60],
  usd_month: [900, 50],
  days: [20, 4],
  index: [100, 5],
  count: [1, 1],
  per_1000_units: [1, 0.8],
  per_100_renters: [1, 0.6],
  per_1000_residents: [2, 1.5],
}

const allUses: MetricUse[] = [
  ...Object.values(COMPONENTS).flatMap((cs) => cs.flatMap((c) => c.metrics)),
  ...RISK_FACTORS.flatMap((f) => f.metrics),
  ...Object.values(STRATEGIES).flatMap((s) => s.evidence),
]

/**
 * Every scored metric for one geography, ordered so that a higher `rank` is better on every
 * dimension and less risky on every risk factor. Derived metrics are injected directly.
 */
export function rankedGeo(g: Geography, rank: number, opts: { confidence?: ConfidenceLevel; flags?: HardRiskFlag[]; promoted?: boolean; asOf?: string } = {}): GeoInput {
  const seen = new Map<string, number>()
  for (const u of allUses) {
    if (seen.has(u.metric)) continue
    const def = METRICS[u.metric]
    const good = !(u.better === 'lower' || u.riskier === 'higher')
    let v: number
    if (def?.scale) {
      const span = def.scale.max - def.scale.min
      const t = Math.min(1, rank / 5)
      v = def.scale.min + span * (good ? t : 1 - t)
    } else if (u.metric === 'acs.median_year_built') v = 1950 + rank
    else {
      // Plausible magnitudes per unit (synthetic); a higher rank is always better / less risky.
      const [base, step] = UNIT_SCALE[def?.unit ?? 'ratio'] ?? [1, 1]
      v = base + step * (good ? rank : 10 - rank)
    }
    seen.set(u.metric, v)
  }
  seen.set('strat.rbr_allowed', 1)
  return {
    geo: g,
    observations: [...seen].map(([m, v]) => obs(g.id, m, v, opts.asOf, { confidence: opts.confidence ?? 'official_primary' })),
    samples: [],
    hardFlags: opts.flags ?? [],
    promoted: opts.promoted ?? false,
  }
}
