/** Source-agnostic ingestion contract (VF-03 §14–15). Add a provider without touching scoring. */
import type { ConfidenceLevel, DistributionBin, Geography, GeoLevel } from '../engine/types'

export interface ProviderContext {
  fetch: typeof fetch
  env: Record<string, string | undefined>
  now: Date
}

/** One value as the provider understood it, before validation. */
export interface FetchedObservation {
  metric: string
  value: number
  unit: string
  moe?: number | null
  detail?: { bins: DistributionBin[] } | null
  source: string
  sourceUrl: string | null
  asOf: string
  confidence: ConfidenceLevel
  methodology: string
  /** The raw source value(s) this observation came from. */
  raw?: unknown
}

export interface ProviderResult {
  observations: FetchedObservation[]
  /** Raw payloads, stored with the run. */
  payloads: unknown[]
  /** Request URLs with credentials removed. */
  requests: string[]
  warnings: string[]
}

export interface EnvVar {
  name: string
  required: boolean
  help: string
}

export interface MarketDataProvider {
  id: string
  name: string
  description: string
  homepage: string
  levels: GeoLevel[]
  env: EnvVar[]
  /** Bump when parsing or methodology changes; stored with every run and observation. */
  version: string
  fetch(geo: Geography, ctx: ProviderContext, parent?: Geography | null): Promise<ProviderResult>
}

export const configured = (p: MarketDataProvider, env: Record<string, string | undefined>) =>
  p.env.filter((e) => e.required).every((e) => Boolean(env[e.name]))

/** Removes credentials from a URL before it is stored or shown. */
export const redact = (url: string) => url.replace(/([?&](?:key|api_key|registrationkey|token)=)[^&]+/gi, '$1REDACTED')

export class ProviderError extends Error {}

export async function getJson(ctx: ProviderContext, url: string, init?: RequestInit): Promise<unknown> {
  const res = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
  const text = await res.text()
  if (!res.ok) throw new ProviderError(`${redact(url)} → HTTP ${res.status}: ${text.slice(0, 200)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderError(`${redact(url)} → not JSON: ${text.slice(0, 200)}`)
  }
}

/** State postal code → FIPS (Census). */
export const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16',
  IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29',
  MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42',
  RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72',
}
