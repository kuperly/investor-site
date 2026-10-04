import { describe, expect, it } from 'vitest'
import { compStats, median, monthsSince, pricePerSqft, summaryFromComps, type Comp } from './comps'

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
