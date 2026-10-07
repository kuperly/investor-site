import { blsLaus } from './providers/bls-laus'
import { censusAcs } from './providers/census-acs'
import { fred } from './providers/fred'
import { hudFmr } from './providers/hud-fmr'
import type { MarketDataProvider } from './types'

/** V1 sources: official / primary only (VF-03 §14). No MLS, Zillow scraping or paid data. */
export const PROVIDERS: MarketDataProvider[] = [censusAcs, hudFmr, blsLaus, fred]

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null
