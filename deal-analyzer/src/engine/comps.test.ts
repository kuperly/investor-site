import { describe, expect, it } from 'vitest'
import { compArv, compStats, compWeight, decayFactor, median, monthsSince, pricePerSqft, summaryFromComps, type Comp } from './comps'

const comp = (o: Partial<Comp>): Comp => ({
  address: 'x',
  salePrice: null,
  saleDate: null,
  sqft: null,
  beds: null,
  baths: null,
  distanceMiles: null,
  condition: null,
  renovation: null,
  saleStatus: null,
  tier: 'standard',
  shareOverride: null,
  source: null,
  sourceUrl: null,
  notes: null,
  included: true,
  ...o,
})
const asOf = new Date('2026-10-01T00:00:00Z')

describe('comp helpers', () => {
  it('price per sqft, guarded', () => {
    expect(pricePerSqft(210_000, 1_400)).toBe(150)
    expect(pricePerSqft(210_000, 0)).toBeNull()
    expect(pricePerSqft(null, 1_400)).toBeNull()
    expect(pricePerSqft(210_000, null)).toBeNull()
  })
  it('median of odd / even / empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
  it('months since sale', () => {
    expect(monthsSince('2026-04-01', asOf)).toBeCloseTo(6, 0)
    expect(monthsSince(null, asOf)).toBeNull()
    expect(monthsSince('not-a-date', asOf)).toBeNull()
  })
})

describe('compStats', () => {
  const comps = [
    comp({ salePrice: 200_000, sqft: 1_000, distanceMiles: 0.5, saleDate: '2026-07-01', renovation: 'renovated' }),
    comp({ salePrice: 220_000, sqft: 1_100, distanceMiles: 1.0, saleDate: '2026-04-01', renovation: 'renovated' }),
    comp({ salePrice: 140_000, sqft: 1_000, distanceMiles: 0.8, saleDate: '2026-01-01', renovation: 'unrenovated' }),
    comp({ salePrice: null, sqft: 1_200, renovation: null }), // unknown price: counted, not priced
    comp({ salePrice: 900_000, sqft: 1_000, included: false }), // excluded outlier
  ]
  const s = compStats(comps, asOf)

  it('uses only included comps and reports exclusions', () => {
    expect(s.all.count).toBe(4)
    expect(s.excluded).toBe(1)
    expect(s.all.maxPrice).toBe(220_000)
  })
  it('skips unknown prices instead of treating them as $0', () => {
    expect(s.all.withPrice).toBe(3)
    expect(s.all.avgPrice).toBeCloseTo((200_000 + 220_000 + 140_000) / 3)
    expect(s.all.minPrice).toBe(140_000)
  })
  it('separates renovated vs unrenovated and counts unclassified', () => {
    expect(s.renovated.count).toBe(2)
    expect(s.renovated.medianPrice).toBe(210_000)
    expect(s.renovated.medianPpsf).toBe(200)
    expect(s.unrenovated.count).toBe(1)
    expect(s.unrenovated.avgPpsf).toBe(140)
    expect(s.unclassified).toBe(1)
  })
  it('distance and recency ranges', () => {
    expect(s.all.maxDistance).toBe(1.0)
    expect(s.all.newestMonths).toBeCloseTo(3, 0)
    expect(s.all.oldestMonths).toBeCloseTo(9, 0)
  })
  it('summary fields for the deal', () => {
    expect(summaryFromComps(s)).toEqual({
      compCount: 4,
      compAvgPrice: 186_667,
      compMedianPrice: 200_000,
      compDistanceMiles: 1,
      compRecencyMonths: s.all.oldestMonths,
      compRenovatedCount: 2,
      compUnrenovatedCount: 1,
    })
  })
  it('an empty list yields counts of 0 and UNKNOWN (null) statistics', () => {
    const e = compStats([], asOf)
    expect(e.all.count).toBe(0)
    expect(e.all.medianPrice).toBeNull()
    expect(summaryFromComps(e).compAvgPrice).toBeNull()
  })
})

describe('decayFactor', () => {
  it('1 at zero, linear to the floor, then flat; unknown → floor', () => {
    expect(decayFactor(0, 12)).toBe(1)
    expect(decayFactor(6, 12)).toBeCloseTo(0.625) // 1 − 0.75 × 0.5
    expect(decayFactor(12, 12)).toBeCloseTo(0.25)
    expect(decayFactor(30, 12)).toBeCloseTo(0.25)
    expect(decayFactor(-6, 12)).toBeCloseTo(0.625) // distance either side
    expect(decayFactor(null, 12)).toBe(0.25)
  })
})

describe('compWeight', () => {
  const subject = { sqft: 1_400, beds: 3, baths: 2 }
  it('perfect comp: same day, 0 mi, identical, sold → weight 1 (× tier)', () => {
    const w = compWeight(comp({ saleDate: '2026-10-01', distanceMiles: 0, sqft: 1_400, beds: 3, baths: 2, saleStatus: 'sold' }), subject, asOf)
    expect(w.weight).toBeCloseTo(1)
    const sc = compWeight(comp({ saleDate: '2026-10-01', distanceMiles: 0, sqft: 1_400, beds: 3, baths: 2, saleStatus: 'sold', tier: 'superComp' }), subject, asOf)
    expect(sc.weight).toBeCloseTo(3)
  })
  it('hand-calculated mixed comp', () => {
    // age ≈ 6 mo → recency ≈ 0.625; 1 mi → 1 − 0.75×0.5 = 0.625
    // sqft 1,540 = +10% → 1 − 0.75×(0.1/0.3) = 0.75; beds 4 (1 apart) → 0.625; baths 2 → 1; pending → 0.75
    // similarity = (0.75 + 0.625 + 1 + 0.75) / 4 = 0.78125 ; tier best fit = 2
    const w = compWeight(comp({ saleDate: '2026-04-01', distanceMiles: 1, sqft: 1_540, beds: 4, baths: 2, saleStatus: 'pending', tier: 'bestFit' }), subject, asOf)
    expect(w.recency).toBeCloseTo(0.625, 2)
    expect(w.distance).toBeCloseTo(0.625)
    expect(w.similarityParts).toMatchObject({ beds: 0.625, baths: 1, status: 0.75 })
    expect(w.similarityParts.sqft).toBeCloseTo(0.75)
    expect(w.similarity).toBeCloseTo(0.78125)
    expect(w.weight).toBeCloseTo(2 * w.recency * 0.625 * 0.78125)
  })
  it('unknown comp facts score at the floor and are listed; unknown subject facts are skipped', () => {
    const w = compWeight(comp({ sqft: 1_400 }), { sqft: 1_400, beds: null, baths: null }, asOf)
    expect(w.recency).toBe(0.25)
    expect(w.distance).toBe(0.25)
    expect(w.similarityParts).toEqual({ sqft: 1, beds: null, baths: null, status: 0.25 })
    expect(w.similarity).toBeCloseTo((1 + 0.25) / 2)
    expect(w.unknowns.sort()).toEqual(['distance', 'sale date', 'status'])
  })
})

describe('compArv (weighted $/sqft × subject sqft)', () => {
  const subject = { sqft: 1_400, beds: 3, baths: 2 }
  const perfect = { saleDate: '2026-10-01', distanceMiles: 0, beds: 3, baths: 2, saleStatus: 'sold' as const, renovation: 'renovated' as const }
  it('hand calculation: super comp at $200/sf (w 3) + standard at $150/sf (w 1)', () => {
    const r = compArv(
      [
        comp({ ...perfect, address: 'A', salePrice: 280_000, sqft: 1_400, tier: 'superComp' }), // $200/sf
        comp({ ...perfect, address: 'B', salePrice: 210_000, sqft: 1_400 }), // $150/sf
      ],
      subject,
      asOf,
    )
    // weighted $/sf = (3×200 + 1×150) / 4 = 187.5 ; × 1,400 = 262,500
    expect(r.weightedPpsf).toBeCloseTo(187.5)
    expect(r.arv).toBe(262_500)
    expect(r.used.map((u) => u.share)).toEqual([0.75, 0.25])
    // unweighted median $/sf = 175 × 1,400 = 245,000
    expect(r.medianPpsfArv).toBe(245_000)
  })
  it('uses only included, renovated comps with price and sqft; says why others were left out', () => {
    const r = compArv(
      [
        comp({ ...perfect, address: 'ok', salePrice: 210_000, sqft: 1_400 }),
        comp({ ...perfect, address: 'excl', salePrice: 900_000, sqft: 1_000, included: false }),
        comp({ ...perfect, address: 'unreno', salePrice: 120_000, sqft: 1_400, renovation: 'unrenovated' }),
        comp({ ...perfect, address: 'unknown-reno', salePrice: 120_000, sqft: 1_400, renovation: null }),
        comp({ ...perfect, address: 'noprice', sqft: 1_400 }),
        comp({ ...perfect, address: 'nosqft', salePrice: 200_000 }),
      ],
      subject,
      asOf,
    )
    expect(r.arv).toBe(210_000)
    expect(r.excluded.map((e) => [e.comp.address, e.reason])).toEqual([
      ['excl', 'excluded by user'],
      ['unreno', 'not marked renovated'],
      ['unknown-reno', 'not marked renovated'],
      ['noprice', 'no sale price'],
      ['nosqft', 'no sqft'],
    ])
  })
  it('UNKNOWN (null) when there are no usable comps or subject sqft is unknown — never $0', () => {
    expect(compArv([], subject, asOf).arv).toBeNull()
    const r = compArv([comp({ ...perfect, salePrice: 210_000, sqft: 1_400 })], { sqft: null, beds: 3, baths: 2 }, asOf)
    expect(r.weightedPpsf).toBeCloseTo(150)
    expect(r.arv).toBeNull()
  })
})

describe('compArv — % override on Super comps', () => {
  const subject = { sqft: 1_400, beds: 3, baths: 2 }
  const perfect = { saleDate: '2026-10-01', distanceMiles: 0, beds: 3, baths: 2, saleStatus: 'sold' as const, renovation: 'renovated' as const, sqft: 1_400 }
  const sup = (o: Partial<Comp>) => comp({ ...perfect, tier: 'superComp', ...o })
  const std = (o: Partial<Comp>) => comp({ ...perfect, ...o })

  it('hand calculation: super comp fixed at 50%, two equal standard comps split the other 50%', () => {
    const r = compArv(
      [
        sup({ address: 'S', salePrice: 280_000, shareOverride: 0.5 }), // $200/sf
        std({ address: 'A', salePrice: 210_000 }), // $150/sf
        std({ address: 'B', salePrice: 238_000 }), // $170/sf
      ],
      subject,
      asOf,
    )
    // 0.5×200 + 0.25×150 + 0.25×170 = 100 + 37.5 + 42.5 = 180 $/sf × 1,400 = 252,000
    expect(r.used.map((u) => [u.comp.address, u.share, u.overridden])).toEqual([
      ['S', 0.5, true],
      ['A', 0.25, false],
      ['B', 0.25, false],
    ])
    expect(r.weightedPpsf).toBeCloseTo(180)
    expect(r.arv).toBe(252_000)
    expect(r.issues).toEqual([])
  })
  it('override replaces the tier multiplier for that comp (without it the super comp would get 3/5)', () => {
    const base = [sup({ address: 'S', salePrice: 280_000 }), std({ address: 'A', salePrice: 210_000 }), std({ address: 'B', salePrice: 238_000 })]
    expect(compArv(base, subject, asOf).used[0].share).toBeCloseTo(0.6)
    expect(compArv([{ ...base[0], shareOverride: 0.4 }, base[1], base[2]], subject, asOf).used[0].share).toBeCloseTo(0.4)
  })
  it('several overridden super comps share the fixed part; 100% fixed leaves others at 0%', () => {
    const r = compArv([sup({ address: 'S1', salePrice: 280_000, shareOverride: 0.7 }), sup({ address: 'S2', salePrice: 210_000, shareOverride: 0.3 }), std({ address: 'A', salePrice: 100_000 })], subject, asOf)
    expect(r.used.map((u) => u.share)).toEqual([0.7, 0.3, 0])
    expect(r.weightedPpsf).toBeCloseTo(0.7 * 200 + 0.3 * 150)
  })
  it('overrides above 100% → ARV UNKNOWN with an explanation (never a silently wrong number)', () => {
    const r = compArv([sup({ address: 'S1', salePrice: 280_000, shareOverride: 0.7 }), sup({ address: 'S2', salePrice: 210_000, shareOverride: 0.5 })], subject, asOf)
    expect(r.arv).toBeNull()
    expect(r.issues[0]).toMatch(/total 120.0% — must be 100% or less/)
  })
  it('no other comp to take the remainder → overrides scaled to 100% and flagged', () => {
    const r = compArv([sup({ address: 'S', salePrice: 280_000, shareOverride: 0.6 })], subject, asOf)
    expect(r.used[0].share).toBeCloseTo(1)
    expect(r.arv).toBe(280_000)
    expect(r.issues[0]).toMatch(/scaled up to 100%/)
  })
  it('override on a non-super comp, or on a comp not used for ARV, is ignored and reported', () => {
    const r = compArv(
      [
        std({ address: 'A', salePrice: 210_000, shareOverride: 0.9 }),
        std({ address: 'B', salePrice: 238_000 }),
        sup({ address: 'U', salePrice: 120_000, renovation: 'unrenovated', shareOverride: 0.5 }),
      ],
      subject,
      asOf,
    )
    expect(r.used.map((u) => u.share)).toEqual([0.5, 0.5])
    expect(r.issues).toEqual([
      '% override on U not applied — comp not used (not marked renovated)',
      '% override on A ignored — only Super comps can have one',
    ])
  })
})
