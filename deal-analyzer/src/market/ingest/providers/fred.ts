/**
 * FRED (Federal Reserve Bank of St. Louis) — metro series by CBSA (FRED_API_KEY, free):
 *   MEDDAYONMAR{cbsa}  median days on market      (Realtor.com, monthly — commercial data)
 *   ACTLISCOU{cbsa}    active listing count       (Realtor.com, monthly)
 *   PRIREDCOU{cbsa}    price-reduced listing count (Realtor.com, monthly)
 *   ATNHPIUS{cbsa}Q    FHFA all-transactions HPI  (official, quarterly)
 * Realtor.com series are commercial data republished by FRED → "verified local/commercial".
 */
import type { ConfidenceLevel } from '../../engine/types'
import { getJson, ProviderError, redact, type FetchedObservation, type MarketDataProvider } from '../types'

const SERIES: { id: (cbsa: string) => string; metric: string; unit: string; confidence: ConfidenceLevel; keep: number; label: string }[] = [
  { id: (c) => `MEDDAYONMAR${c}`, metric: 'fred.median_dom', unit: 'days', confidence: 'verified_local_commercial', keep: 13, label: 'Realtor.com median days on market' },
  { id: (c) => `ACTLISCOU${c}`, metric: 'fred.active_listings', unit: 'count', confidence: 'verified_local_commercial', keep: 25, label: 'Realtor.com active listing count' },
  { id: (c) => `PRIREDCOU${c}`, metric: 'fred.price_reduced_count', unit: 'count', confidence: 'verified_local_commercial', keep: 13, label: 'Realtor.com price-reduced listing count' },
  { id: (c) => `ATNHPIUS${c}Q`, metric: 'fred.hpi', unit: 'index', confidence: 'official_primary', keep: 25, label: 'FHFA all-transactions house price index' },
]

interface FredObs {
  observations?: { date: string; value: string }[]
  error_message?: string
}

export function parseFred(body: FredObs): { asOf: string; value: number }[] {
  if (!body.observations) throw new ProviderError(`FRED: ${body.error_message ?? 'no observations'}`)
  return body.observations.filter((o) => o.value !== '.' && o.value !== '').map((o) => ({ asOf: o.date, value: Number(o.value) })).filter((o) => Number.isFinite(o.value))
}

export const fred: MarketDataProvider = {
  id: 'fred',
  name: 'FRED — Realtor.com listings & FHFA house prices (metro)',
  description: 'Median days on market, active and price-reduced listings (liquidity, price reductions, supply), and the FHFA house price index (price growth and volatility).',
  homepage: 'https://fred.stlouisfed.org/',
  levels: ['msa'],
  env: [{ name: 'FRED_API_KEY', required: true, help: 'Free key: https://fredaccount.stlouisfed.org/apikeys' }],
  version: 'fred/1',
  async fetch(geo, ctx) {
    if (!geo.code) throw new ProviderError('FRED: the MSA needs its CBSA code')
    const start = new Date(ctx.now)
    start.setUTCFullYear(start.getUTCFullYear() - 7)
    const observations: FetchedObservation[] = []
    const payloads: unknown[] = []
    const requests: string[] = []
    const warnings: string[] = []
    for (const s of SERIES) {
      const id = s.id(geo.code)
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&file_type=json&observation_start=${start.toISOString().slice(0, 10)}&api_key=${encodeURIComponent(ctx.env.FRED_API_KEY ?? '')}`
      requests.push(redact(url))
      try {
        const body = (await getJson(ctx, url)) as FredObs
        payloads.push(body)
        const pts = parseFred(body).sort((a, b) => b.asOf.localeCompare(a.asOf)).slice(0, s.keep)
        for (const p of pts)
          observations.push({
            metric: s.metric,
            value: p.value,
            unit: s.unit,
            source: `FRED series ${id} (${s.label})`,
            sourceUrl: `https://fred.stlouisfed.org/series/${id}`,
            asOf: p.asOf,
            confidence: s.confidence,
            methodology: s.label,
            raw: p,
          })
      } catch (e) {
        warnings.push(`${id}: ${e instanceof Error ? e.message : e}`)
      }
    }
    if (!observations.length) throw new ProviderError(`FRED returned nothing for CBSA ${geo.code}: ${warnings.join('; ')}`)
    return { observations, payloads, requests, warnings }
  },
}
