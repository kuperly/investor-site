import { describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { analyzeDeal } from '@/engine/analyze'
import { avatarFit, shareInRange, validateAvatar, type Avatar } from './avatar'
import { capitalEvidence, median, sampleMetrics } from './capital'
import { explainChange } from './change'
import { DEFAULT_MARKET_CONFIG as CFG, resolveConfig } from './config'
import { deriveEvidence, moeAdjusted } from './derive'
import { evaluateMarkets, partial, percentile, riskLevelFor } from './evaluate'
import { EVAL_DATE, geo, obs, rankedGeo } from './fixtures'
import { FRESHNESS_POLICIES, freshness } from './freshness'
import { candidateToDeal, validateCandidate, type Candidate } from './handoff'
import { opportunityUniverse } from './universe'
import { validateObservation } from './validate'

describe('normalization', () => {
  it('mid-rank percentile among peers', () => {
    const v = [10, 20, 30, 40, 50]
    expect(percentile(30, v)).toBe(50) // 2 below, (2 + 0) / 4 = 50%
    expect(percentile(10, v)).toBe(0)
    expect(percentile(50, v)).toBe(100)
    expect(percentile(10, [10, 10, 30])).toBe(25) // ties share the mid-rank: (0 + 0.5) / 2
    expect(percentile(7, [7])).toBe(50) // a single value is the middle, flagged as a thin peer group elsewhere
  })

  it('partial roll-up keeps UNKNOWN out of the point and reports honest bounds', () => {
    // weights .2 / .3 / .5, scores 80 / UNKNOWN / 40
    const p = partial([{ weight: 0.2, score: 80 }, { weight: 0.3, score: null }, { weight: 0.5, score: 40 }])
    expect(p.point).toBe(51.4) // (16 + 20) / 0.7 = 51.43
    expect(p.low).toBe(36) // 16 + 0 + 20
    expect(p.high).toBe(66) // 16 + 30 + 20
    expect(p.completeness).toBe(0.7)
    expect(partial([{ weight: 1, score: null }])).toEqual({ point: null, low: 0, high: 100, completeness: 0 })
  })

  it('risk bands', () => {
    expect(riskLevelFor(24.9, CFG)).toBe('Low')
    expect(riskLevelFor(25, CFG)).toBe('Moderate')
    expect(riskLevelFor(45, CFG)).toBe('Elevated')
    expect(riskLevelFor(65, CFG)).toBe('High')
  })
})

describe('freshness (metric-specific)', () => {
  it('ACS 5-year: fresh for 27 months after the period ends, then declines to stale at 39', () => {
    expect(freshness('2024-12-31', '2026-10-07', FRESHNESS_POLICIES.acs5).status).toBe('fresh') // ~21 months
    const aging = freshness('2024-12-31', '2027-12-31', FRESHNESS_POLICIES.acs5) // 36 months
    expect(aging.status).toBe('aging')
    expect(aging.score).toBe(25) // 100 × (39 − 36) / (39 − 27)
    expect(freshness('2024-12-31', '2028-06-30', FRESHNESS_POLICIES.acs5).status).toBe('stale')
  })
  it('the same 21-month age is stale for a monthly series', () => {
    expect(freshness('2024-12-31', '2026-10-07', FRESHNESS_POLICIES.bls_monthly).status).toBe('stale')
  })
})

describe('confidence', () => {
  it('ACS margin of error lowers the level by the coefficient of variation', () => {
    expect(moeAdjusted('official_primary', 1000, 100)).toMatchObject({ level: 'official_primary' }) // CV 6.1%
    expect(moeAdjusted('official_primary', 1000, 300).level).toBe('verified_local_commercial') // CV 18.2%
    expect(moeAdjusted('official_primary', 1000, 1000).level).toBe('multiple_secondary') // CV 60.8%
    expect(moeAdjusted('official_primary', 1000, null).cv).toBeNull()
  })
})

describe('derived metrics', () => {
  const g = 'cbsa:1'
  const base = [
    obs(g, 'acs.occupied_units', 1000, '2024-12-31'),
    obs(g, 'acs.renter_occupied', 400, '2024-12-31'),
    obs(g, 'acs.vacant_for_rent', 20, '2024-12-31'),
    obs(g, 'acs.rented_not_occupied', 5, '2024-12-31'),
    obs(g, 'acs.median_gross_rent', 1000, '2019-12-31'),
    obs(g, 'acs.median_gross_rent', 1200, '2024-12-31'),
    obs(g, 'acs.housing_units', 1000, '2019-12-31'),
    obs(g, 'acs.housing_units', 1100, '2024-12-31'),
    obs(g, 'acs.households', 900, '2019-12-31'),
    obs(g, 'acs.households', 945, '2024-12-31', { confidence: 'single_secondary' }),
    obs(g, 'acs.unemployed', 50, '2024-12-31'),
    obs(g, 'acs.civilian_labor_force', 1000, '2024-12-31'),
    obs(g, 'fred.price_reduced_count', 30, '2026-08-01'),
    obs(g, 'fred.active_listings', 120, '2026-08-01'),
    obs(g, 'fred.active_listings', 100, '2025-08-01'),
    obs(g, 'hud.fmr_3br', 1650, '2025-10-01'),
    obs(g, 'acs.median_gross_rent_3br', 1500, '2024-12-31'),
  ]
  const ev = deriveEvidence(base)

  it('ratios from the same ACS release', () => {
    expect(ev['d.renter_share'].value).toBe(0.4) // 400 / 1000
    expect(ev['d.rental_vacancy'].value).toBeCloseTo(20 / 425, 10) // 20 / (400 + 20 + 5) = 4.71%
    expect(ev['d.unemployment_rate'].value).toBe(0.05) // 50 / 1000
    expect(ev['d.price_reduction_share'].value).toBe(0.25) // 30 / 120
    expect(ev['d.section8_rent_ratio'].value).toBeCloseTo(1.1, 10) // 1650 / 1500
  })

  it('5-year growth between non-overlapping ACS releases; latest value wins', () => {
    expect(ev['acs.median_gross_rent'].value).toBe(1200)
    expect(ev['d.rent_growth_5y'].value).toBeCloseTo(0.2, 10) // 1200 / 1000 − 1
    expect(ev['d.supply_vs_households_5y'].value).toBeCloseTo(0.05, 10) // +10% units − +5% households
    expect(ev['d.listings_growth_1y'].value).toBeCloseTo(0.2, 10) // 120 / 100 − 1
  })

  it('a derived value takes its weakest input’s confidence and keeps its inputs', () => {
    expect(ev['d.supply_vs_households_5y'].confidence).toBe('single_secondary')
    expect(ev['d.rent_growth_5y'].derivedFrom).toEqual(['acs.median_gross_rent', 'acs.median_gross_rent'])
  })

  it('never mixes releases and never invents a missing input', () => {
    const mixed = deriveEvidence([obs(g, 'acs.renter_occupied', 400, '2024-12-31'), obs(g, 'acs.occupied_units', 1000, '2023-12-31')])
    expect(mixed['d.renter_share']).toBeUndefined()
    expect(deriveEvidence([obs(g, 'acs.median_gross_rent', 1200, '2024-12-31')])['d.rent_growth_5y']).toBeUndefined()
  })

  it('BLS unemployment wins over ACS when present', () => {
    const e = deriveEvidence([...base, obs(g, 'bls.unemployment_rate', 0.041, '2026-08-01')])
    expect(e['d.unemployment_rate'].value).toBe(0.041)
  })

  it('HPI volatility = st. dev. of the annual changes', () => {
    // 10% every year → st. dev. 0; then one year of +21% changes it.
    const steady = [100, 110, 121, 133.1, 146.41, 161.051].map((v, i) => obs(g, 'fred.hpi', v, `${2021 + i}-04-01`))
    expect(deriveEvidence(steady)['d.hpi_volatility'].value).toBeCloseTo(0, 10)
    expect(deriveEvidence(steady)['d.hpi_growth_1y'].value).toBeCloseTo(0.1, 10)
  })
})

describe('capital efficiency reuses the Deal Analyzer engine', () => {
  it('takes ratios of analyzeDeal outputs — no duplicated formulas', () => {
    const inputs = sampleInputs()
    const a = analyzeDeal(inputs).base
    const r = sampleMetrics({ id: 's1', label: 'Sample', kind: 'assumption', confidence: 'single_secondary', source: 'test', asOf: '2026-09-01', inputs })
    expect(r.values['ce.equity_per_capital']).toBe((a.equityCreated as number) / (a.refi.totalCashInvested as number))
    expect(r.values['ce.capital_recycled']).toBe(a.refi.capitalRecycledPct)
    expect(r.values['ce.profit_per_capital']).toBe(a.flip.roi)
    expect(r.values['ce.refi_potential']).toBe((a.refi.refiLoan as number) / (a.totalProjectCost as number))
  })

  it('an UNKNOWN Deal Analyzer result stays UNKNOWN (never 0)', () => {
    const r = sampleMetrics({ id: 's', label: 'No ARV', kind: 'assumption', confidence: 'single_secondary', source: 't', asOf: '2026-09-01', inputs: sampleInputs({ arvBase: null }) })
    expect(r.values['ce.equity_per_capital']).toBeUndefined()
  })

  it('median across samples', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    const s = (id: string, price: number) => ({ id, label: id, kind: 'assumption' as const, confidence: 'verified_local_commercial' as const, source: 't', asOf: '2026-09-01', inputs: sampleInputs({ purchasePrice: price }) })
    const { evidence } = capitalEvidence([s('a', 100_000), s('b', 110_000), s('c', 120_000)])
    const mid = sampleMetrics(s('b', 110_000)).values['ce.equity_per_capital']
    expect(evidence['ce.equity_per_capital'].value).toBe(mid) // equity/capital falls as price rises → the middle price is the median
  })
})

describe('evaluateMarkets', () => {
  it('hand-checked: one known metric → point from what is known, bounds, range display, WATCH', () => {
    const geos = [0.3, 0.4, 0.5].map((v, i) => ({ geo: geo(`cbsa:${i}`), observations: [obs(`cbsa:${i}`, 'd.renter_share', v)], samples: [], hardFlags: [], promoted: false }))
    const e = evaluateMarkets(geos, CFG, EVAL_DATE).find((x) => x.geoId === 'cbsa:2')!
    const mq = e.dimensions.marketQuality
    expect(mq.components.find((c) => c.key === 'rentalDemand')!.score).toBe(100)
    expect(mq).toMatchObject({ point: 100, low: 20, high: 100, completeness: 0.2 }) // rental demand is 20% of MQ
    expect(e.dimensions.opportunityDensity.point).toBeNull()
    expect(e.strategies.find((s) => s.key === 'rentByRoom')!.fit).toBeNull() // legality unknown → not scored
    expect(e.priority.core).toMatchObject({ point: 100, low: 5, high: 100, completeness: 0.05 }) // .25 × 20 = 5
    // No risk evidence: point uses 1.00, the low bound the High modifier 0.70.
    expect(e.priority).toMatchObject({ point: 100, low: 3.5, high: 100, display: 'range', rank: null })
    expect(e.confidence.score).toBe(5) // .25 × (.2 × 100)
    expect(e.decision.state).toBe('WATCH')
    expect(e.drillDown.state).toBe('not_eligible')
  })

  const six = (opts: Parameters<typeof rankedGeo>[2] = {}, level: 'msa' | 'zcta' = 'msa') =>
    [0, 1, 2, 3, 4, 5].map((r) => rankedGeo(geo(`${level === 'msa' ? 'cbsa' : 'zcta'}:${r}`, level, level === 'zcta' ? 'cbsa:p' : null), r, opts))

  it('strong MSA → DRILL_DOWN until promoted, then KEEP; weak with good evidence → DROP', () => {
    const evals = evaluateMarkets(six(), CFG, EVAL_DATE)
    const best = evals.find((e) => e.geoId === 'cbsa:5')!
    const worst = evals.find((e) => e.geoId === 'cbsa:0')!
    expect(best.confidence.score).toBe(100)
    expect(best.risk.level).toBe('Low')
    expect(best.priority.display).toBe('precise')
    expect(best.priority.rank).toBe(1)
    expect(best.decision.state).toBe('DRILL_DOWN')
    expect(best.drillDown.state).toBe('eligible')
    expect(worst.decision.state).toBe('DROP')
    expect(worst.priority.rank).toBe(6)
    const promoted = evaluateMarkets(six().map((g) => (g.geo.id === 'cbsa:5' ? { ...g, promoted: true } : g)), CFG, EVAL_DATE)
    expect(promoted.find((e) => e.geoId === 'cbsa:5')!.decision.state).toBe('KEEP')
  })

  it('ZIPs are ranked within their parent and a strong ZIP is KEEP (operational level)', () => {
    const evals = evaluateMarkets(six({}, 'zcta'), CFG, EVAL_DATE)
    const best = evals.find((e) => e.geoId === 'zcta:5')!
    expect(best.peerGroup).toEqual({ key: 'zcta@cbsa:p', size: 6 })
    expect(best.decision.state).toBe('KEEP')
    expect(best.drillDown.state).toBe('not_applicable')
  })

  it('a critical hard flag BLOCKS regardless of the score; a high flag forces the High modifier', () => {
    const flag = (severity: 'critical' | 'high') => ({ id: 'f', geoId: 'cbsa:5', severity, category: 'Regulatory', reason: 'test', source: 'test', sourceUrl: null })
    const blocked = evaluateMarkets(six().map((g) => (g.geo.id === 'cbsa:5' ? { ...g, hardFlags: [flag('critical')] } : g)), CFG, EVAL_DATE).find((e) => e.geoId === 'cbsa:5')!
    expect(blocked.priority).toMatchObject({ point: null, blocked: true, rank: null })
    expect(blocked.decision.state).toBe('DROP')
    const high = evaluateMarkets(six().map((g) => (g.geo.id === 'cbsa:5' ? { ...g, hardFlags: [flag('high')] } : g)), CFG, EVAL_DATE).find((e) => e.geoId === 'cbsa:5')!
    expect(high.risk.level).toBe('High')
    expect(high.priority.point).toBe(Math.round((high.priority.core.point as number) * 0.7 * 10) / 10)
  })

  it('low-confidence evidence never produces a precise ranking', () => {
    const evals = evaluateMarkets(six({ confidence: 'anecdotal' }), CFG, EVAL_DATE)
    for (const e of evals) {
      expect(e.priority.display).toBe('range')
      expect(e.priority.rank).toBeNull()
      expect(['KEEP', 'DRILL_DOWN']).not.toContain(e.decision.state)
    }
    // Weak-looking, but on anecdotal evidence: WATCH, not DROP.
    const worst = evals.find((e) => e.geoId === 'cbsa:0')!
    expect(worst.decision.state).toBe('WATCH')
    expect(worst.decision.reasons[0]).toMatch(/evidence is too weak to drop it/)
  })

  it('fewer peers than the minimum → no ranking and no KEEP', () => {
    const evals = evaluateMarkets(six({}, 'zcta').slice(3), CFG, EVAL_DATE)
    expect(evals.every((e) => e.priority.display === 'range' && e.decision.state !== 'KEEP')).toBe(true)
  })

  it('stale evidence is reported and blocks KEEP', () => {
    const evals = evaluateMarkets(six({ asOf: '2020-01-01' }, 'zcta'), CFG, EVAL_DATE)
    const best = evals.find((e) => e.geoId === 'zcta:5')!
    expect(best.freshness.stale.length).toBeGreaterThan(0)
    expect(best.decision.state).toBe('WATCH')
  })

  it('Strategy Fit rewards several strong strategies instead of averaging all nine', () => {
    const best = evaluateMarkets(six(), CFG, EVAL_DATE).find((e) => e.geoId === 'cbsa:5')!
    const top = best.strategies.filter((s) => s.fit !== null).map((s) => s.fit as number).sort((a, b) => b - a)
    expect(best.dimensions.strategyFit.point).toBe(Math.round((0.5 * top[0] + 0.3 * top[1] + 0.2 * top[2]) * 10) / 10)
  })

  it('rent by room is 0 where it is not allowed', () => {
    const gs = six().map((g) => ({ ...g, observations: g.observations.map((o) => (o.metric === 'strat.rbr_allowed' ? { ...o, value: 0 } : o)) }))
    const e = evaluateMarkets(gs, CFG, EVAL_DATE)[0]
    expect(e.strategies.find((s) => s.key === 'rentByRoom')).toMatchObject({ fit: 0, gateBlocked: true })
  })
})

describe('change detection', () => {
  it('explains a priority change; the lines add up to the total', () => {
    const before = evaluateMarkets([0.3, 0.4, 0.5].map((v, i) => ({ geo: geo(`cbsa:${i}`), observations: [obs(`cbsa:${i}`, 'd.renter_share', v), obs(`cbsa:${i}`, 'd.rent_growth_5y', [0.1, 0.2, 0.3][i])], samples: [], hardFlags: [], promoted: false })), CFG, EVAL_DATE)
    const after = evaluateMarkets([0.3, 0.6, 0.5].map((v, i) => ({ geo: geo(`cbsa:${i}`), observations: [obs(`cbsa:${i}`, 'd.renter_share', v), obs(`cbsa:${i}`, 'd.rent_growth_5y', [0.1, 0.2, 0.3][i])], samples: [], hardFlags: [], promoted: false })), CFG, EVAL_DATE)
    const c = explainChange(before[1], after[1], CFG)
    // cbsa:1 renter share went from the middle (50) to the top (100) of its peers.
    expect(c.from).toBe(50) // (.2 × 50 + .15 × 50) / .35
    expect(c.to).toBe(78.6) // (.2 × 100 + .15 × 50) / .35 = 78.57
    expect(c.delta).toBe(28.6)
    const dims = c.lines.filter((l) => l.kind !== 'component')
    expect(dims.reduce((s, l) => s + l.delta, 0)).toBeCloseTo(28.6, 1)
    expect(c.lines.find((l) => l.label === 'Rental demand')!.delta).toBe(28.6)
    expect(c.significant).toBe(true)
    expect(c.metricChanges.find((m) => m.metric === 'd.renter_share')).toMatchObject({ from: 0.4, to: 0.6 })
  })
})

describe('avatars and the opportunity universe', () => {
  const bins = (pairs: [string, number | null, number | null, number][]) => pairs.map(([key, lo, hi, count]) => ({ key, label: key, lo, hi, count }))
  const g = 'zcta:1'
  const ev = deriveEvidence([
    obs(g, 'acs.housing_units', 10_000, '2024-12-31'),
    obs(g, 'acs.units_in_structure_dist', 10_000, '2024-12-31', { detail: { bins: bins([['1_detached', 1, 2, 6_000], ['2', 2, 3, 1_000], ['3_4', 3, 5, 1_000], ['5_9', 5, 10, 2_000]]) } }),
    obs(g, 'acs.bedrooms_dist', 10_000, '2024-12-31', { detail: { bins: bins([['b2', 2, 3, 5_000], ['b3', 3, 4, 5_000]]) } }),
    obs(g, 'acs.year_built_dist', 10_000, '2024-12-31', { detail: { bins: bins([['y1940', 1940, 1950, 5_000], ['y1950', 1950, 1960, 5_000]]) } }),
    obs(g, 'acs.median_gross_rent_3br', 1_500, '2024-12-31'),
    obs(g, 'opp.absentee_share', 0.2, '2026-01-01', { confidence: 'verified_local_commercial' }),
  ])
  const avatar: Avatar = {
    id: 'a1', name: 'Test avatar', description: '', propertyTypes: ['sfh_detached'], bedsMin: 3, bedsMax: 3, yearBuiltMin: 1945, yearBuiltMax: 1954,
    sqftMin: null, sqftMax: null, purchaseMin: null, purchaseMax: null, arvMin: null, arvMax: null, rentMin: 1_400, rehabMin: null, rehabMax: null, strategies: ['brrrr'], active: true,
  }

  it('shares within bins assume an even spread', () => {
    expect(shareInRange(bins([['a', 1940, 1950, 100], ['b', 1950, 1960, 100]]), 1945, 1955, 1900, 2030)).toBe(0.5) // 50 + 50 of 200
  })

  it('avatar fit multiplies the shares (independence) and estimates matching units', () => {
    const f = avatarFit(avatar, ev)
    // type 6,000/10,000 = .6; 3 BR 5,000/10,000 = .5; built 1945–1954: 2,500 + 2,500 = .5
    expect(f.shares.map((s) => s.share)).toEqual([0.6, 0.5, 0.5])
    expect(f.matchShare).toBeCloseTo(0.15, 10)
    expect(f.estimatedUnits).toBe(1_500) // 10,000 × .15
    expect(f.rentCheck).toMatchObject({ medianRent: 1_500, ok: true })
  })

  it('validates avatar ranges', () => {
    expect(validateAvatar({ ...avatar, bedsMin: 4, bedsMax: 3 }).bedsMax).toBeDefined()
    expect(validateAvatar({ ...avatar, propertyTypes: [] }).propertyTypes).toBeDefined()
    expect(validateAvatar(avatar)).toEqual({})
  })

  it('universe lines: counts from evidence, estimates labelled, unknown stays null', () => {
    const u = opportunityUniverse(ev, [avatar])
    expect(u.find((l) => l.key === 'sfh')!.value).toBe(6_000)
    expect(u.find((l) => l.key === 'smallMf')!.value).toBe(2_000)
    expect(u.find((l) => l.key === 'absentee')).toMatchObject({ value: 2_000, estimate: true }) // .2 × 10,000
    expect(u.find((l) => l.key === 'foreclosure')!.value).toBeNull()
    expect(u.find((l) => l.key === 'avatar:a1')!.value).toBe(1_500)
  })
})

describe('hand-off to the Deal Analyzer', () => {
  const c: Candidate = {
    id: 'c1', geoId: 'zcta:1', geoName: 'ZIP 75201', avatarName: 'Test avatar', address: '1 Main St', city: 'Dallas', state: 'TX', zip: '75201',
    propertyType: 'SFR', beds: 3, baths: 1, sqft: 1_200, yearBuilt: 1955, askingPrice: 120_000, condition: 'Dated', estArv: 200_000, estRehab: 40_000, estRent: 1_500,
    source: 'Driving for dollars', sourceUrl: null, notes: null,
  }
  it('fills property facts and asking price only; estimates go to the note', () => {
    const h = candidateToDeal(c)
    expect(h.inputs).toMatchObject({ address: '1 Main St', zip: '75201', beds: 3, askingPrice: 120_000, market: 'ZIP 75201' })
    for (const k of ['arvBase', 'arvConservative', 'arvUpside', 'rehabEstimate', 'marketRent', 'purchasePrice'] as const) expect(h.inputs[k]).toBeUndefined()
    expect(h.note).toMatch(/NOT applied/)
    expect(h.note).toMatch(/ARV ≈ \$200,000/)
  })
  it('validates candidates', () => {
    expect(validateCandidate({ ...c, address: ' ', source: '' })).toMatchObject({ address: expect.any(String), source: expect.any(String) })
    expect(validateCandidate({ ...c, sourceUrl: 'javascript:alert(1)' }).sourceUrl).toBeDefined()
    expect(validateCandidate(c)).toEqual({})
  })
})

describe('observation validation', () => {
  it('rejects sentinels, missing sources, future dates, impossible shares and computed metrics', () => {
    const ok = obs('g', 'acs.median_gross_rent', 1_200, '2024-12-31')
    expect(validateObservation(ok, EVAL_DATE)).toEqual([])
    expect(validateObservation({ ...ok, value: -666_666_666 }, EVAL_DATE)[0]).toMatch(/plausible range/)
    expect(validateObservation({ ...ok, source: ' ' }, EVAL_DATE)[0]).toMatch(/source is required/)
    expect(validateObservation({ ...ok, asOf: '2027-01-01' }, EVAL_DATE)[0]).toMatch(/future/)
    expect(validateObservation(obs('g', 'opp.absentee_share', 1.2), EVAL_DATE)[0]).toMatch(/range 0–1/)
    expect(validateObservation(obs('g', 'd.renter_share', 0.4), EVAL_DATE)[0]).toMatch(/computed/)
    expect(validateObservation({ ...ok, sourceUrl: 'ftp://x' }, EVAL_DATE)[0]).toMatch(/http/)
  })
})

describe('configuration', () => {
  it('applies valid overrides and rejects unknown or out-of-range ones', () => {
    const { config, rejected } = resolveConfig({ 'decision.keepMinPriority': 75, 'riskModifiers.High': 2, 'weights.x': 1 })
    expect(config.decision.keepMinPriority).toBe(75)
    expect(config.riskModifiers.High).toBe(0.7)
    expect(rejected).toEqual(['riskModifiers.High', 'weights.x'])
    expect(CFG.decision.keepMinPriority).toBe(70) // defaults untouched
  })
})
