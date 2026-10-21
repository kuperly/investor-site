/**
 * HUD USER — Fair Market Rents / Small Area FMRs (official, annual, fiscal year from Oct 1).
 * API: https://www.huduser.gov/hudapi/public/fmr  (token required: HUD_API_TOKEN, free).
 * Implemented from HUD's published API documentation; not exercised live in the build
 * environment (no token) — the parser is tested against recorded response shapes.
 */
import type { Geography } from '../../engine/types'
import { getJson, ProviderError, type FetchedObservation, type MarketDataProvider, type ProviderContext } from '../types'

const BASE = 'https://www.huduser.gov/hudapi/public/fmr'

interface MetroArea {
  cbsa_code: string
  area_name: string
}
interface FmrRow {
  zip_code?: string
  'Two-Bedroom'?: number | string
  'Three-Bedroom'?: number | string
}
interface FmrData {
  data?: { year?: string | number; metroname?: string; area_name?: string; smallarea_status?: string | number; basicdata?: FmrRow | FmrRow[] }
}

const auth = (ctx: ProviderContext) => ({ headers: { Authorization: `Bearer ${ctx.env.HUD_API_TOKEN ?? ''}` } })

/** HUD metro FMR areas inside a CBSA ("METRO19100M19124" …). Prefers the area named after the CBSA itself. */
export function pickHudArea(areas: MetroArea[], cbsa: string): MetroArea | null {
  const inCbsa = areas.filter((a) => a.cbsa_code?.startsWith(`METRO${cbsa}`))
  return inCbsa.find((a) => a.cbsa_code === `METRO${cbsa}M${cbsa}`) ?? inCbsa[0] ?? null
}

export function parseFmr(body: FmrData, zip: string | null): { year: number; twoBr: number | null; threeBr: number | null; level: 'msa' | 'zip'; area: string } {
  const d = body.data
  if (!d?.basicdata) throw new ProviderError('HUD FMR: response has no basicdata')
  const year = Number(d.year)
  if (!Number.isFinite(year)) throw new ProviderError('HUD FMR: response has no year')
  const rows = Array.isArray(d.basicdata) ? d.basicdata : [d.basicdata]
  const row = zip ? rows.find((r) => r.zip_code === zip) : (rows.find((r) => /msa level/i.test(r.zip_code ?? '')) ?? (rows.length === 1 ? rows[0] : undefined))
  if (!row) throw new ProviderError(zip ? `HUD FMR: no Small Area FMR for ZIP ${zip}` : 'HUD FMR: no metro-level row')
  const n = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v))
  return { year, twoBr: n(row['Two-Bedroom']), threeBr: n(row['Three-Bedroom']), level: zip ? 'zip' : 'msa', area: d.metroname ?? d.area_name ?? '' }
}

export const hudFmr: MarketDataProvider = {
  id: 'hud-fmr',
  name: 'HUD — Fair Market Rents (FMR / Small Area FMR)',
  description: '2- and 3-bedroom Fair Market Rents for the metro area, or the ZIP-level Small Area FMR where HUD publishes one. Used for the Section 8 / HCV strategy overlay.',
  homepage: 'https://www.huduser.gov/portal/dataset/fmr-api.html',
  levels: ['msa', 'zcta'],
  env: [{ name: 'HUD_API_TOKEN', required: true, help: 'Free token: https://www.huduser.gov/hudapi/public/register' }],
  version: 'hud-fmr/1',
  async fetch(geo: Geography, ctx: ProviderContext, parent?: Geography | null) {
    const cbsa = geo.level === 'msa' ? geo.code : parent?.level === 'msa' ? parent.code : null
    if (!cbsa) throw new ProviderError('HUD FMR: a ZIP must sit under an MSA (directly) to find its FMR area')
    const listUrl = `${BASE}/listMetroAreas`
    const areas = (await getJson(ctx, listUrl, auth(ctx))) as MetroArea[]
    const area = pickHudArea(Array.isArray(areas) ? areas : [], cbsa)
    if (!area) throw new ProviderError(`HUD FMR: no HUD metro area found for CBSA ${cbsa}`)
    const dataUrl = `${BASE}/data/${area.cbsa_code}`
    const body = (await getJson(ctx, dataUrl, auth(ctx))) as FmrData
    const p = parseFmr(body, geo.level === 'zcta' ? geo.code : null)
    const common = {
      unit: 'usd_month',
      source: `HUD ${p.level === 'zip' ? 'Small Area ' : ''}Fair Market Rents FY${p.year}, ${area.area_name}`,
      sourceUrl: 'https://www.huduser.gov/portal/datasets/fmr.html',
      asOf: `${p.year - 1}-10-01`,
      confidence: 'official_primary' as const,
    }
    const observations: FetchedObservation[] = []
    if (p.twoBr !== null) observations.push({ ...common, metric: 'hud.fmr_2br', value: p.twoBr, methodology: `HUD FY${p.year} ${p.level === 'zip' ? 'SAFMR' : 'FMR'}, 2 bedrooms (${area.cbsa_code})`, raw: p })
    if (p.threeBr !== null) observations.push({ ...common, metric: 'hud.fmr_3br', value: p.threeBr, methodology: `HUD FY${p.year} ${p.level === 'zip' ? 'SAFMR' : 'FMR'}, 3 bedrooms (${area.cbsa_code})`, raw: p })
    const warnings = area.cbsa_code !== `METRO${cbsa}M${cbsa}` ? [`HUD splits CBSA ${cbsa}; used HUD area ${area.cbsa_code} (${area.area_name})`] : []
    return { observations, payloads: [body], requests: [listUrl, dataUrl], warnings }
  },
}
