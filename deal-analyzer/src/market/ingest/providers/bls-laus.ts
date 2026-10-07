/**
 * BLS — Local Area Unemployment Statistics, metropolitan areas (official, monthly).
 * API v2: https://api.bls.gov/publicAPI/v2/timeseries/data/  (BLS_API_KEY recommended; without
 * it BLS allows very few requests per day). Series: LAUMT{state FIPS}{CBSA}00000003 (rate),
 * …0005 (employment). Multi-state metros use the principal (first-listed) state's code.
 */
import { getJson, ProviderError, STATE_FIPS, type FetchedObservation, type MarketDataProvider } from '../types'

interface BlsResponse {
  status?: string
  message?: string[]
  Results?: { series?: { seriesID: string; data: { year: string; period: string; value: string; footnotes?: { code?: string }[] }[] }[] }
}

export const lausSeries = (stateFips: string, cbsa: string, measure: '03' | '05') => `LAUMT${stateFips}${cbsa}000000${measure}`

export function parseBls(body: BlsResponse): Map<string, { asOf: string; value: number; preliminary: boolean }[]> {
  if (body.status !== 'REQUEST_SUCCEEDED') throw new ProviderError(`BLS: ${body.status ?? 'no status'} ${(body.message ?? []).join(' ')}`.trim())
  const out = new Map<string, { asOf: string; value: number; preliminary: boolean }[]>()
  for (const s of body.Results?.series ?? []) {
    const points = s.data
      .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-' && d.value !== '')
      .map((d) => ({ asOf: `${d.year}-${d.period.slice(1)}-01`, value: Number(d.value), preliminary: (d.footnotes ?? []).some((f) => f.code === 'P') }))
      .filter((d) => Number.isFinite(d.value))
    out.set(s.seriesID, points)
  }
  return out
}

export const blsLaus: MarketDataProvider = {
  id: 'bls-laus',
  name: 'BLS — Local Area Unemployment Statistics (metro)',
  description: 'Monthly unemployment rate and employment for the metro area (latest 25 months, for 12-month change).',
  homepage: 'https://www.bls.gov/lau/',
  levels: ['msa'],
  env: [{ name: 'BLS_API_KEY', required: false, help: 'Free key: https://data.bls.gov/registrationEngine/ (strongly recommended)' }],
  version: 'bls-laus/1',
  async fetch(geo, ctx) {
    const fips = geo.state ? STATE_FIPS[geo.state.toUpperCase()] : undefined
    if (!fips || !geo.code) throw new ProviderError('BLS LAUS: the MSA needs its CBSA code and principal state')
    const rate = lausSeries(fips, geo.code, '03')
    const emp = lausSeries(fips, geo.code, '05')
    const end = ctx.now.getUTCFullYear()
    const url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
    const payload: Record<string, unknown> = { seriesid: [rate, emp], startyear: String(end - 2), endyear: String(end) }
    if (ctx.env.BLS_API_KEY) payload.registrationkey = ctx.env.BLS_API_KEY
    const body = (await getJson(ctx, url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })) as BlsResponse
    const series = parseBls(body)
    const observations: FetchedObservation[] = []
    const warnings: string[] = []
    const add = (id: string, metric: string, unit: string, scale: number, label: string) => {
      const pts = (series.get(id) ?? []).sort((a, b) => b.asOf.localeCompare(a.asOf)).slice(0, 25)
      if (!pts.length) warnings.push(`BLS returned no data for ${id} (check the CBSA's principal state)`)
      for (const p of pts)
        observations.push({
          metric,
          value: p.value * scale,
          unit,
          source: `BLS LAUS series ${id}`,
          sourceUrl: `https://data.bls.gov/timeseries/${id}`,
          asOf: p.asOf,
          confidence: 'official_primary',
          methodology: `${label}${p.preliminary ? ' (preliminary)' : ''}, not seasonally adjusted`,
          raw: p,
        })
    }
    add(rate, 'bls.unemployment_rate', 'ratio', 0.01, 'Unemployment rate (percent ÷ 100)')
    add(emp, 'bls.employment', 'count', 1, 'Employment')
    return { observations, payloads: [body], requests: [`${url} ${rate},${emp}`], warnings }
  },
}
