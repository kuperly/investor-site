import { describe, expect, it } from 'vitest'
import { analyzeDeal } from './analyze'
import { emptyInputs } from './fields'
import { sampleInputs } from './fixtures'

describe('analyzeDeal — sample deal end to end', () => {
  const a = analyzeDeal(sampleInputs())

  it('has no missing data', () => expect(a.missing).toEqual([]))

  it('AC12: score components', () => {
    const byId = Object.fromEntries(a.score.components.map((c) => [c.id, c.points]))
    expect(byId.equity).toBe(25) // 25.2% equity ≥ 20%
    expect(byId.capital).toBeCloseTo(((67_000 / 79_800) / 0.9) * 25, 6)
    expect(byId.exits).toBe(15) // BRRRR, Hold, Flip, Hybrid all viable
    expect(a.score.complete).toBe(true)
  })

  it('AC14: recommends BUY', () => {
    expect(a.score.total).toBeGreaterThanOrEqual(80)
    expect(a.recommendation.recommendation).toBe('BUY')
  })

  it('evaluates every strategy (the deal chooses the strategy)', () => {
    expect(a.strategies.brrrr.viable).toBe(true)
    expect(a.strategies.hold.viable).toBe(true)
    expect(a.strategies.flip.viable).toBe(true)
    expect(a.strategies.hybrid.viable).toBe(true)
    expect(a.strategies.hybrid.bestUseOfCapital).not.toBeNull()
  })

  it('shows Max Offer for all three ARVs', () => {
    expect(a.arvScenarios.map((s) => s.label)).toEqual(['Conservative', 'Base', 'Upside'])
    for (const s of a.arvScenarios) expect(s.maxOffer.maxPurchasePrice).not.toBeNull()
    const [c, b, u] = a.arvScenarios.map((s) => s.maxOffer.maxPurchasePrice!)
    expect(c).toBeLessThan(b)
    expect(b).toBeLessThan(u)
  })

  it('generates human-readable explanations from computed facts', () => {
    expect(a.why.strengths).toContain('25% equity creation')
    expect(a.why.strengths.some((s) => s.includes('exits remain viable'))).toBe(true)
  })
})

describe('AC11: stress tests', () => {
  const a = analyzeDeal(sampleInputs())
  const row = (id: string) => a.stress.find((r) => r.id === id)!

  it('produces the five spec scenarios', () => {
    expect(a.stress.map((r) => r.label)).toEqual(['Base', 'ARV −10%', 'Rent −10%', 'Rehab +15%', 'Combined stress'])
  })
  it('base row equals the base underwriting', () => {
    expect(row('base').allIn).toBeCloseTo(a.base.totalProjectCost!)
    expect(row('base').dscr).toBeCloseTo(a.base.refi.dscr!)
  })
  it('ARV −10% lowers equity by 10% of ARV and leaves all-in unchanged', () => {
    expect(row('arvDown').allIn).toBeCloseTo(row('base').allIn!)
    expect(row('arvDown').equity).toBeCloseTo(row('base').equity! - 20_000)
    expect(row('arvDown').refiLoan).toBeCloseTo(135_000)
  })
  it('Rent −10% lowers DSCR but not all-in', () => {
    expect(row('rentDown').allIn).toBeCloseTo(row('base').allIn!)
    expect(row('rentDown').dscr!).toBeLessThan(row('base').dscr!)
  })
  it('Rehab +15% raises all-in by 15% of rehab incl. contingency', () => {
    expect(row('rehabUp').allIn).toBeCloseTo(row('base').allIn! + 44_000 * 0.15)
  })
  it('combined stress compounds all three shocks', () => {
    expect(row('combined').allIn).toBeCloseTo(row('rehabUp').allIn!)
    expect(row('combined').flipProfit!).toBeLessThan(row('arvDown').flipProfit!)
    expect(row('combined').flipProfit!).toBeLessThan(row('rehabUp').flipProfit!)
    expect(row('combined').cashLeft!).toBeGreaterThan(row('base').cashLeft!)
    expect(row('combined').dscr!).toBeLessThan(row('base').dscr!)
  })
  it('lower ARV shrinks the refi loan, so ARV −10% alone can raise DSCR', () => {
    expect(row('arvDown').dscr!).toBeGreaterThan(row('base').dscr!)
  })
})

describe('AC13: hard gates', () => {
  it('a checklist "yes" forces PASS even on a high-scoring deal', () => {
    const a = analyzeDeal(sampleInputs({ gateTitleIssue: 'yes' }))
    expect(a.score.total).toBeGreaterThanOrEqual(80)
    expect(a.recommendation.recommendation).toBe('PASS')
  })
  it('DSCR below the lender minimum fails the gate', () => {
    const a = analyzeDeal(sampleInputs({ refiMinDscr: 1.2 }))
    expect(a.gates.find((g) => g.id === 'dscrBelowMin')!.status).toBe('FAIL')
    expect(a.recommendation.recommendation).toBe('PASS')
  })
  it('negative post-refi cash flow fails the gate', () => {
    const a = analyzeDeal(sampleInputs({ marketRent: 1_200 }))
    expect(a.gates.find((g) => g.id === 'negativeCashFlow')!.status).toBe('FAIL')
    expect(a.recommendation.recommendation).toBe('PASS')
  })
  it('no viable exit fails the gate', () => {
    const a = analyzeDeal(sampleInputs({ marketRent: 900, conservativeRent: 900, arvBase: 150_000 }))
    expect(a.strategies.viableCount).toBe(0)
    expect(a.gates.find((g) => g.id === 'noCredibleExit')!.status).toBe('FAIL')
  })
  it('lender minimum DSCR missing → DSCR gate UNKNOWN → never BUY', () => {
    const a = analyzeDeal(sampleInputs({ refiMinDscr: null }))
    expect(a.gates.find((g) => g.id === 'dscrBelowMin')!.status).toBe('UNKNOWN')
    expect(a.recommendation.recommendation).not.toBe('BUY')
  })
  it('unassessed checklist gates block BUY', () => {
    const a = analyzeDeal(sampleInputs({ gateUninsurable: 'unknown' }))
    expect(a.recommendation.recommendation).toBe('INVESTIGATE')
  })
})

describe('AC18: data integrity', () => {
  it('insurance unknown → warning text from the spec, and no BUY', () => {
    const a = analyzeDeal(sampleInputs({ insuranceAnnual: null }))
    expect(a.missing.map((m) => m.message)).toContain('Underwriting incomplete — insurance estimate required.')
    expect(a.base.refi.dscr).toBeNull()
    expect(a.recommendation.recommendation).not.toBe('BUY')
  })

  it('a brand-new empty deal computes without throwing and reports everything missing', () => {
    const a = analyzeDeal(emptyInputs())
    expect(a.base.totalProjectCost).toBeNull()
    expect(a.missing.length).toBeGreaterThan(20)
    expect(a.score.total).toBe(0)
    expect(['INVESTIGATE', 'PASS']).toContain(a.recommendation.recommendation)
  })
})

describe('seasoning notice', () => {
  it('warns when the refi is modeled before seasoning is met', () => {
    const a = analyzeDeal(sampleInputs({ projectMonths: 4, refiSeasoningMonths: 6 }))
    expect(a.notices.join(' ')).toMatch(/seasoning requirement is 6 months/)
  })
})
