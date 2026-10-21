import { describe, expect, it } from 'vitest'
import type { Geography } from '../engine/types'
import { validateObservation } from '../engine/validate'
import { blsLaus, lausSeries, parseBls } from './providers/bls-laus'
import { censusAcs } from './providers/census-acs'
import { fred, parseFred } from './providers/fred'
import { hudFmr, parseFmr, pickHudArea } from './providers/hud-fmr'
import { configured, redact, type ProviderContext } from './types'

const msa: Geography = { id: 'cbsa:19100', level: 'msa', code: '19100', name: 'Dallas-Fort Worth-Arlington, TX', parentId: null, state: 'TX' }
const zip: Geography = { id: 'zcta:75216', level: 'zcta', code: '75216', name: 'ZIP 75216', parentId: 'cbsa:19100', state: 'TX' }

/** Records requests; answers from `route`. */
function fakeCtx(route: (url: string, init?: RequestInit) => unknown, env: Record<string, string> = {}): ProviderContext & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    env,
    now: new Date('2026-10-07T12:00:00Z'),
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push(String(url))
      const body = route(String(url), init)
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: body === 404 ? 404 : 200 })
    }) as typeof fetch,
  }
}

describe('Census ACS provider', () => {
  const census = (url: string) => {
    const u = new URL(url)
    const vars = u.searchParams.get('get')!.split(',')
    const year = Number(u.pathname.split('/')[2])
    const value = (v: string) => {
      if (v === 'NAME') return 'Dallas-Fort Worth-Arlington, TX Metro Area'
      if (v === 'B25064_001E') return year === 2024 ? '1400' : '1100'
      if (v === 'B25035_001E') return '1985'
      if (v === 'B25077_001E') return year === 2024 ? '-666666666' : '200000' // 2024 sentinel → rejected, never 0
      if (v.endsWith('M')) return '25'
      return '1000'
    }
    return [vars, vars.map(value)]
  }

  it('maps verified ACS variables to metrics, keeps margins of error, current + 5-years-earlier releases', async () => {
    const ctx = fakeCtx(census, { CENSUS_API_KEY: 'secret-key' })
    const r = await censusAcs.fetch(msa, ctx)
    const rent = r.observations.filter((o) => o.metric === 'acs.median_gross_rent')
    expect(rent.map((o) => [o.asOf, o.value])).toEqual([['2024-12-31', 1400], ['2019-12-31', 1100]])
    expect(rent[0]).toMatchObject({ moe: 25, confidence: 'official_primary', source: 'U.S. Census Bureau, ACS 5-year 2020–2024, table B25064' })
    const yb = r.observations.find((o) => o.metric === 'acs.year_built_dist')!
    expect(yb.detail!.bins).toHaveLength(10)
    expect(yb.detail!.bins[9]).toMatchObject({ key: 'y1939', lo: null, hi: 1940, count: 1000 })
    expect(r.observations.find((o) => o.metric === 'acs.home_value_dist')!.detail!.bins).toHaveLength(26)
    // the sentinel is kept for validation to reject, not turned into a number
    const value = r.observations.find((o) => o.metric === 'acs.median_home_value' && o.asOf === '2024-12-31')!
    expect(validateObservation({ ...value, geoId: msa.id, retrievedAt: '' }, '2026-10-07')[0]).toMatch(/plausible range/)
    // keys never leak into stored request URLs
    expect(r.requests.every((u) => u.includes('key=REDACTED') && !u.includes('secret-key'))).toBe(true)
    expect(ctx.calls.every((u) => u.includes('metropolitan%20statistical%20area'))).toBe(true)
  })

  it('ZCTAs before 2020 are queried within their state', async () => {
    const ctx = fakeCtx(census, { CENSUS_API_KEY: 'k' })
    await censusAcs.fetch(zip, ctx)
    expect(ctx.calls.some((u) => u.includes('/2019/') && u.includes('in=state:48'))).toBe(true)
    expect(ctx.calls.some((u) => u.includes('/2024/') && !u.includes('in=state'))).toBe(true)
  })

  it('a missing earlier release leaves growth UNKNOWN with a warning', async () => {
    const ctx = fakeCtx((u) => (u.includes('/2019/') ? 404 : census(u)), { CENSUS_API_KEY: 'k' })
    const r = await censusAcs.fetch(msa, ctx)
    expect(r.observations.some((o) => o.asOf === '2019-12-31')).toBe(false)
    expect(r.warnings.join(' ')).toMatch(/growth metrics stay UNKNOWN/)
  })
})

describe('HUD FMR provider', () => {
  const areas = [
    { cbsa_code: 'METRO19100M19124', area_name: 'Dallas, TX HUD Metro FMR Area' },
    { cbsa_code: 'METRO19100M23104', area_name: 'Fort Worth-Arlington, TX HUD Metro FMR Area' },
  ]
  it('picks a HUD area inside the CBSA and reads metro or ZIP rows', () => {
    expect(pickHudArea(areas, '19100')!.cbsa_code).toBe('METRO19100M19124')
    expect(pickHudArea(areas, '12060')).toBeNull()
    const safmr = { data: { year: 2026, basicdata: [{ zip_code: 'MSA level', 'Two-Bedroom': 1700, 'Three-Bedroom': 2200 }, { zip_code: '75216', 'Two-Bedroom': 1400, 'Three-Bedroom': 1800 }] } }
    expect(parseFmr(safmr, null)).toMatchObject({ year: 2026, twoBr: 1700, threeBr: 2200, level: 'msa' })
    expect(parseFmr(safmr, '75216')).toMatchObject({ threeBr: 1800, level: 'zip' })
    expect(parseFmr({ data: { year: 2026, basicdata: { 'Two-Bedroom': 1500, 'Three-Bedroom': 1900 } } }, null).threeBr).toBe(1900)
    expect(() => parseFmr(safmr, '99999')).toThrow(/no Small Area FMR/)
  })
  it('sends the token as a bearer header and dates FMRs to the fiscal-year start', async () => {
    let auth = ''
    const ctx = fakeCtx((u, init) => {
      auth = String((init?.headers as Record<string, string>)?.Authorization)
      return u.endsWith('listMetroAreas') ? areas : { data: { year: 2026, basicdata: { 'Two-Bedroom': 1500, 'Three-Bedroom': 1900 } } }
    }, { HUD_API_TOKEN: 'tok' })
    const r = await hudFmr.fetch(msa, ctx)
    expect(auth).toBe('Bearer tok')
    expect(r.observations.map((o) => [o.metric, o.value, o.asOf])).toEqual([['hud.fmr_2br', 1500, '2025-10-01'], ['hud.fmr_3br', 1900, '2025-10-01']])
    expect(r.warnings[0]).toMatch(/HUD splits CBSA 19100/)
  })
})

describe('BLS LAUS provider', () => {
  it('builds metro series ids and reads monthly values (rate ÷ 100), skipping annual averages', async () => {
    expect(lausSeries('48', '19100', '03')).toBe('LAUMT481910000000003')
    const body = {
      status: 'REQUEST_SUCCEEDED',
      Results: {
        series: [
          { seriesID: 'LAUMT481910000000003', data: [{ year: '2026', period: 'M08', value: '4.1', footnotes: [{ code: 'P' }] }, { year: '2025', period: 'M13', value: '4.0' }] },
          { seriesID: 'LAUMT481910000000005', data: [{ year: '2026', period: 'M08', value: '4100000' }, { year: '2025', period: 'M08', value: '4000000' }] },
        ],
      },
    }
    const r = await blsLaus.fetch(msa, fakeCtx(() => body))
    const rate = r.observations.find((o) => o.metric === 'bls.unemployment_rate')!
    expect(rate).toMatchObject({ asOf: '2026-08-01', unit: 'ratio' })
    expect(rate.value).toBeCloseTo(0.041, 10)
    expect(rate.methodology).toMatch(/preliminary/)
    expect(r.observations.filter((o) => o.metric === 'bls.employment')).toHaveLength(2)
    expect(() => parseBls({ status: 'REQUEST_NOT_PROCESSED', message: ['daily threshold'] })).toThrow(/threshold/)
  })
})

describe('FRED provider', () => {
  it('reads Realtor.com (commercial) and FHFA (official) series, skipping "." gaps', async () => {
    expect(parseFred({ observations: [{ date: '2026-08-01', value: '.' }, { date: '2026-07-01', value: '52' }] })).toEqual([{ asOf: '2026-07-01', value: 52 }])
    const r = await fred.fetch(msa, fakeCtx((u) => ({ observations: [{ date: '2026-07-01', value: u.includes('ATNHPI') ? '400.5' : '52' }] }), { FRED_API_KEY: 'k' }))
    expect(r.observations.find((o) => o.metric === 'fred.median_dom')).toMatchObject({ value: 52, confidence: 'verified_local_commercial' })
    expect(r.observations.find((o) => o.metric === 'fred.hpi')).toMatchObject({ value: 400.5, confidence: 'official_primary' })
    expect(r.requests.every((u) => !u.includes('api_key=k'))).toBe(true)
  })
})

describe('provider configuration', () => {
  it('a provider with a missing required key is not configured; keys are redacted', () => {
    expect(configured(censusAcs, {})).toBe(false)
    expect(configured(censusAcs, { CENSUS_API_KEY: 'x' })).toBe(true)
    expect(configured(blsLaus, {})).toBe(true) // key optional
    expect(redact('https://x/y?a=1&api_key=SECRET&b=2')).toBe('https://x/y?a=1&api_key=REDACTED&b=2')
  })
})
