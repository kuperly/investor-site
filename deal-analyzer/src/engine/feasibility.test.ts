import { describe, expect, it } from 'vitest'
import { feasibilityAt, targetPrice } from './feasibility'
import { sampleInputs } from './fixtures'

// Sample deal: ARV 200,000, target All-in 70 % → maximum All-in 140,000.
// Price-independent costs (fixed) = rehab 44,000 + loan fees 1,000 + holding 2,400
// + inspection/attorney/title 3,000 = 50,400.
// Price-dependent costs per $ of price = 1 + closing 3 % + points 2 % × 80 % LTV (1.6 %)
// + interest 12 % × 80 % × 6/12 (4.8 %) = 1.094.
// Base Max Offer = (140,000 − 50,400) / 1.094 = 81,901.28.
const MAX_OFFER = 89_600 / 1.094

describe('feasibilityAt', () => {
  it('at asking 100,000: gap $ and %, above target → not feasible, strategies still reported', () => {
    const f = feasibilityAt(sampleInputs(), 100_000, 'At asking')
    expect(f.maxOffer.base).toBeCloseTo(MAX_OFFER, 6)
    expect(f.gapUsd).toBeCloseTo(100_000 - MAX_OFFER, 6) // 18,098.72
    expect(f.gapPct).toBeCloseTo((100_000 - MAX_OFFER) / 100_000, 9) // 18.10 %
    expect(f.withinTarget).toBe(false)
    expect(f.status).toBe('not_feasible')
    expect(f.strategies.flip).toBe(true) // 200,000 − 12,000 selling − 159,800 = 28,200 > 0
    expect(f.reasons[0]).toContain('18.1% off this price')
  })

  it('at the base Max Offer itself: within target and a viable exit → feasible', () => {
    const f = feasibilityAt(sampleInputs(), MAX_OFFER, 'At target')
    expect(f.gapUsd).toBeCloseTo(0, 6)
    expect(f.withinTarget).toBe(true)
    // All-in at Max Offer = 0.7 × ARV
    expect(f.allIn).toBeCloseTo(140_000, 4)
    expect(f.status).toBe('feasible')
  })

  it('Max Offer does not depend on the price tested', () => {
    const a = feasibilityAt(sampleInputs(), 60_000, 'x')
    const b = feasibilityAt(sampleInputs(), 120_000, 'y')
    expect(a.maxOffer).toEqual(b.maxOffer)
  })

  it('no price → unknown, never a pass', () => {
    const f = feasibilityAt(sampleInputs(), null, 'At asking')
    expect(f.status).toBe('unknown')
    expect(f.gapUsd).toBeNull()
    expect(f.gapPct).toBeNull()
  })

  it('a price below a PARTIAL Max Offer is not proven within target; above it is proven', () => {
    // Holding costs UNKNOWN → left out → Max Offer optimistic (higher).
    const below = feasibilityAt(sampleInputs({ holdingCosts: null }), 70_000, 'x')
    expect(below.withinTarget).toBeNull()
    expect(below.status).toBe('unknown')
    const above = feasibilityAt(sampleInputs({ holdingCosts: null }), 150_000, 'y')
    expect(above.withinTarget).toBe(false)
    expect(above.status).toBe('not_feasible')
  })

  it('price 0 → gap % is not computed (no division by zero)', () => {
    expect(feasibilityAt(sampleInputs(), 0, 'x').gapPct).toBeNull()
  })
})

describe('targetPrice', () => {
  it('latest offer, then planned offer, then a positive base Max Offer', () => {
    expect(targetPrice(90_000, 85_000, 81_901)).toEqual({ price: 90_000, source: 'latest offer' })
    expect(targetPrice(null, 85_000, 81_901)).toEqual({ price: 85_000, source: 'planned offer' })
    expect(targetPrice(null, null, 81_901)).toEqual({ price: 81_901, source: 'base Max Offer' })
    expect(targetPrice(null, null, -5_000)).toEqual({ price: null, source: null })
    expect(targetPrice(null, null, null)).toEqual({ price: null, source: null })
  })
})
