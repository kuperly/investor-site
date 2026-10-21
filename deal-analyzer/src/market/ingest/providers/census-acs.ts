/**
 * U.S. Census Bureau — American Community Survey 5-year estimates (official, annual).
 * API: https://api.census.gov/data/{year}/acs/acs5  (key required: CENSUS_API_KEY, free).
 * Variable codes verified against the 2024 and 2019 ACS 5-year metadata.
 */
import type { DistributionBin, Geography } from '../../engine/types'
import { getJson, ProviderError, redact, STATE_FIPS, type FetchedObservation, type MarketDataProvider, type ProviderContext } from '../types'

/** Latest published ACS 5-year release (2020–2024, released Dec 2025). Override with ACS_YEAR. */
export const DEFAULT_ACS_YEAR = 2024

const SCALARS: [metric: string, variable: string, unit: string][] = [
  ['acs.population', 'B01003_001', 'count'],
  ['acs.households', 'B11001_001', 'count'],
  ['acs.housing_units', 'B25001_001', 'count'],
  ['acs.occupied_units', 'B25003_001', 'count'],
  ['acs.owner_occupied', 'B25003_002', 'count'],
  ['acs.renter_occupied', 'B25003_003', 'count'],
  ['acs.vacant_for_rent', 'B25004_002', 'count'],
  ['acs.rented_not_occupied', 'B25004_003', 'count'],
  ['acs.median_gross_rent', 'B25064_001', 'usd_month'],
  ['acs.median_gross_rent_3br', 'B25031_005', 'usd_month'],
  ['acs.median_home_value', 'B25077_001', 'usd'],
  ['acs.median_household_income', 'B19013_001', 'usd'],
  ['acs.median_year_built', 'B25035_001', 'year'],
  ['acs.civilian_labor_force', 'B23025_003', 'count'],
  ['acs.unemployed', 'B23025_005', 'count'],
  ['acs.median_re_taxes', 'B25103_001', 'usd'],
  ['acs.owner_units_total', 'B25081_001', 'count'],
  ['acs.owner_units_no_mortgage', 'B25081_009', 'count'],
]

/** Fetched again for the release five years earlier (non-overlapping) to measure growth. */
const GROWTH = ['acs.population', 'acs.households', 'acs.housing_units', 'acs.median_gross_rent', 'acs.median_home_value', 'acs.median_household_income']

type BinDef = [key: string, label: string, lo: number | null, hi: number | null]
const VALUE_EDGES = [0, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000].map((k) => k * 1000)

const DISTRIBUTIONS: { metric: string; table: string; bins: BinDef[] }[] = [
  {
    metric: 'acs.year_built_dist',
    table: 'B25034',
    bins: [
      ['y2020', 'Built 2020 or later', 2020, null],
      ['y2010', 'Built 2010 to 2019', 2010, 2020],
      ['y2000', 'Built 2000 to 2009', 2000, 2010],
      ['y1990', 'Built 1990 to 1999', 1990, 2000],
      ['y1980', 'Built 1980 to 1989', 1980, 1990],
      ['y1970', 'Built 1970 to 1979', 1970, 1980],
      ['y1960', 'Built 1960 to 1969', 1960, 1970],
      ['y1950', 'Built 1950 to 1959', 1950, 1960],
      ['y1940', 'Built 1940 to 1949', 1940, 1950],
      ['y1939', 'Built 1939 or earlier', null, 1940],
    ],
  },
  {
    metric: 'acs.units_in_structure_dist',
    table: 'B25024',
    bins: [
      ['1_detached', '1, detached', 1, 2],
      ['1_attached', '1, attached', 1, 2],
      ['2', '2', 2, 3],
      ['3_4', '3 or 4', 3, 5],
      ['5_9', '5 to 9', 5, 10],
      ['10_19', '10 to 19', 10, 20],
      ['20_49', '20 to 49', 20, 50],
      ['50_plus', '50 or more', 50, null],
      ['mobile', 'Mobile home', null, null],
      ['other', 'Boat, RV, van, etc.', null, null],
    ],
  },
  {
    metric: 'acs.bedrooms_dist',
    table: 'B25041',
    bins: [
      ['b0', 'No bedroom', 0, 1],
      ['b1', '1 bedroom', 1, 2],
      ['b2', '2 bedrooms', 2, 3],
      ['b3', '3 bedrooms', 3, 4],
      ['b4', '4 bedrooms', 4, 5],
      ['b5', '5 or more bedrooms', 5, null],
    ],
  },
  {
    metric: 'acs.home_value_dist',
    table: 'B25075',
    bins: VALUE_EDGES.map((lo, i): BinDef => {
      const hi = VALUE_EDGES[i + 1] ?? null
      return [`v${lo}`, hi === null ? `$${lo.toLocaleString('en-US')} or more` : `$${lo.toLocaleString('en-US')}–$${(hi - 1).toLocaleString('en-US')}`, lo, hi]
    }),
  },
]

const pad3 = (n: number) => String(n).padStart(3, '0')
const distVars = (d: (typeof DISTRIBUTIONS)[number]) => d.bins.map((_, i) => `${d.table}_${pad3(i + 2)}E`)

function geoClause(geo: Geography, year: number): string {
  if (geo.level === 'msa') return `for=${encodeURIComponent('metropolitan statistical area/micropolitan statistical area')}:${geo.code}`
  if (geo.level === 'zcta') {
    const base = `for=${encodeURIComponent('zip code tabulation area')}:${geo.code}`
    // Before 2020 ZCTAs were nested in states.
    if (year < 2020) {
      const fips = geo.state ? STATE_FIPS[geo.state.toUpperCase()] : undefined
      if (!fips) throw new ProviderError(`ZCTA ${geo.code}: state is needed for the ${year} release`)
      return `${base}&in=state:${fips}`
    }
    return base
  }
  throw new ProviderError(`Census ACS: level ${geo.level} not supported yet`)
}

async function query(ctx: ProviderContext, year: number, geo: Geography, vars: string[]) {
  const out: Record<string, string | null> = {}
  const payloads: unknown[] = []
  const requests: string[] = []
  for (let i = 0; i < vars.length; i += 45) {
    const chunk = vars.slice(i, i + 45)
    const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME,${chunk.join(',')}&${geoClause(geo, year)}&key=${encodeURIComponent(ctx.env.CENSUS_API_KEY ?? '')}`
    requests.push(redact(url))
    const body = await getJson(ctx, url)
    payloads.push(body)
    if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[0])) throw new ProviderError(`Census ${year}: unexpected response for ${geo.id}`)
    const [header, row] = body as string[][]
    header.forEach((h, j) => (out[h] = row[j] ?? null))
  }
  return { values: out, payloads, requests }
}

/** Census returns large negative sentinels (e.g. -666666666) for "not available": keep them so validation rejects them. */
const toNum = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? Number.NaN : Number(v))

/** Looks up the official name of a CBSA or ZCTA (used when a geography is added). */
export async function censusName(ctx: ProviderContext, geo: Pick<Geography, 'level' | 'code' | 'state' | 'id' | 'name' | 'parentId'>): Promise<string | null> {
  if (!ctx.env.CENSUS_API_KEY) return null
  const year = Number(ctx.env.ACS_YEAR) || DEFAULT_ACS_YEAR
  const { values } = await query(ctx, year, geo as Geography, ['B01003_001E'])
  return values.NAME ?? null
}

export const censusAcs: MarketDataProvider = {
  id: 'census-acs',
  name: 'U.S. Census Bureau — ACS 5-year',
  description: 'Population, households, housing units, tenure, vacancy, rents, home values, income, labor force, taxes, mortgage status and housing-stock distributions. Current release plus the release five years earlier for growth.',
  homepage: 'https://www.census.gov/data/developers/data-sets/acs-5year.html',
  levels: ['msa', 'zcta'],
  env: [
    { name: 'CENSUS_API_KEY', required: true, help: 'Free key: https://api.census.gov/data/key_signup.html' },
    { name: 'ACS_YEAR', required: false, help: `Latest ACS 5-year release to use (default ${DEFAULT_ACS_YEAR})` },
  ],
  version: 'census-acs/1',
  async fetch(geo, ctx) {
    const year = Number(ctx.env.ACS_YEAR) || DEFAULT_ACS_YEAR
    const prior = year - 5
    const sourceUrl = (y: number) => `https://api.census.gov/data/${y}/acs/acs5`
    const source = (y: number, table: string) => `U.S. Census Bureau, ACS 5-year ${y - 4}–${y}, table ${table}`
    const observations: FetchedObservation[] = []
    const warnings: string[] = []

    const curVars = [...SCALARS.flatMap(([, v]) => [`${v}E`, `${v}M`]), ...DISTRIBUTIONS.flatMap(distVars)]
    const cur = await query(ctx, year, geo, curVars)
    if (cur.values.NAME) warnings.push(`Census name for ${geo.code}: ${cur.values.NAME}`)

    for (const [metric, v, unit] of SCALARS)
      observations.push({
        metric,
        value: toNum(cur.values[`${v}E`]),
        moe: Number.isFinite(toNum(cur.values[`${v}M`])) && toNum(cur.values[`${v}M`]) >= 0 ? toNum(cur.values[`${v}M`]) : null,
        unit,
        source: source(year, v.split('_')[0]),
        sourceUrl: sourceUrl(year),
        asOf: `${year}-12-31`,
        confidence: 'official_primary',
        methodology: `ACS 5-year estimate ${v}E (margin of error ${v}M)`,
        raw: { estimate: cur.values[`${v}E`], moe: cur.values[`${v}M`] },
      })
    for (const d of DISTRIBUTIONS) {
      const vars = distVars(d)
      const bins: DistributionBin[] = d.bins.map(([key, label, lo, hi], i) => ({ key, label, lo, hi, count: toNum(cur.values[vars[i]]) }))
      observations.push({
        metric: d.metric,
        value: bins.reduce((s, b) => s + b.count, 0),
        unit: 'distribution',
        detail: { bins },
        source: source(year, d.table),
        sourceUrl: sourceUrl(year),
        asOf: `${year}-12-31`,
        confidence: 'official_primary',
        methodology: `ACS 5-year table ${d.table}, ${vars[0]}–${vars[vars.length - 1]}`,
        raw: Object.fromEntries(vars.map((v) => [v, cur.values[v]])),
      })
    }

    let past: Awaited<ReturnType<typeof query>> | null = null
    const growthVars = SCALARS.filter(([m]) => GROWTH.includes(m)).flatMap(([, v]) => [`${v}E`, `${v}M`])
    try {
      past = await query(ctx, prior, geo, growthVars)
      for (const [metric, v, unit] of SCALARS.filter(([m]) => GROWTH.includes(m)))
        observations.push({
          metric,
          value: toNum(past.values[`${v}E`]),
          moe: Number.isFinite(toNum(past.values[`${v}M`])) && toNum(past.values[`${v}M`]) >= 0 ? toNum(past.values[`${v}M`]) : null,
          unit,
          source: source(prior, v.split('_')[0]),
          sourceUrl: sourceUrl(prior),
          asOf: `${prior}-12-31`,
          confidence: 'official_primary',
          methodology: `ACS 5-year estimate ${v}E, earlier non-overlapping release for growth`,
          raw: { estimate: past.values[`${v}E`], moe: past.values[`${v}M`] },
        })
    } catch (e) {
      // Geography codes change between releases (e.g. new CBSA delineations): growth stays UNKNOWN.
      warnings.push(`No ${prior} release for ${geo.id} (${e instanceof Error ? e.message : e}); growth metrics stay UNKNOWN`)
    }
    return {
      observations,
      payloads: [...cur.payloads, ...(past?.payloads ?? [])],
      requests: [...cur.requests, ...(past?.requests ?? [])],
      warnings,
    }
  },
}
