import { describe, expect, it } from 'vitest'
import { emptyInputs } from '@/engine/fields'
import { analyzeDeal } from '@/engine/analyze'
import type { Avatar } from '@/market/engine/avatar'
import { buildFunnel } from './funnel'
import { handoffGate, leadGate, targetGate } from './gates'
import { candidateToDeal, validateCandidate, type Candidate } from './handoff'
import { LAYERS } from './layers'
import { addressKey, parseCsv, parseLeadsCsv } from './leads'
import { leadFeasibility, leadInputs, leadQuality, priorityCompare, screenBuyBox } from './screen'

const avatar: Avatar = {
  id: 'a1', name: '3BR SFH', description: '', propertyTypes: ['sfh_detached'], bedsMin: 3, bedsMax: 3, yearBuiltMin: 1940, yearBuiltMax: 1980,
  sqftMin: 1100, sqftMax: 1700, purchaseMin: 80_000, purchaseMax: 150_000, arvMin: 160_000, arvMax: 240_000, rentMin: 1_400, rehabMin: 25_000, rehabMax: 60_000,
  strategies: ['brrrr'], active: true,
}
const lead = {
  propertyType: 'SFR' as const, beds: 3, baths: 1, sqft: 1_200, yearBuilt: 1955, askingPrice: 120_000, estArv: 200_000, estRehab: 40_000, estRent: 1_500,
}

describe('layer map', () => {
  it('six layers, in order, each owned by one module', () => {
    expect(LAYERS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect([...new Set(LAYERS.map((l) => l.module))]).toEqual(['Market Intelligence', 'Deal Sourcing', 'Deal Analyzer'])
  })
})

describe('gates', () => {
  it('layer 2 → 3: KEEP / DRILL_DOWN open; WATCH needs a reason; DROP, blocked or unevaluated never', () => {
    expect(targetGate({ decision: 'KEEP', blocked: false })).toMatchObject({ allowed: true, needsReason: false })
    expect(targetGate({ decision: 'DRILL_DOWN', blocked: false })).toMatchObject({ allowed: true, needsReason: false })
    expect(targetGate({ decision: 'WATCH', blocked: false })).toMatchObject({ allowed: true, needsReason: true })
    expect(targetGate({ decision: 'DROP', blocked: false }).allowed).toBe(false)
    expect(targetGate({ decision: 'DROP', blocked: true }).message).toMatch(/critical/)
    expect(targetGate(null).message).toMatch(/Evaluate/)
  })
  it('layer 3 → 4: only active targets take leads', () => {
    expect(leadGate('active').allowed).toBe(true)
    expect(leadGate('paused').allowed).toBe(false)
    expect(leadGate(null).allowed).toBe(false)
  })
  it('layer 4 → 5: a failed screen needs a reason; incomplete does not', () => {
    expect(handoffGate('fail').needsReason).toBe(true)
    expect(handoffGate('incomplete').needsReason).toBe(false)
    expect(handoffGate('pass').needsReason).toBe(false)
    expect(handoffGate(null).needsReason).toBe(false)
  })
})

describe('buy-box screen (the avatar’s own ranges, nothing invented)', () => {
  it('passes when every known fact is inside the box', () => {
    const s = screenBuyBox(lead, avatar)
    expect(s.overall).toBe('pass')
    expect(s.criteria.map((c) => c.label)).toEqual(['Property type', 'Bedrooms', 'Year built', 'Square feet', 'Asking price', 'Estimated ARV', 'Estimated rehab', 'Estimated rent ($/mo)'])
  })
  it('one physical fact outside → fail, with the reason', () => {
    expect(screenBuyBox({ ...lead, propertyType: 'Duplex' }, avatar).overall).toBe('fail')
    expect(screenBuyBox({ ...lead, beds: 5 }, avatar).criteria.find((c) => c.label === 'Bedrooms')).toMatchObject({ result: 'fail', detail: '5 vs 3–3' })
  })
  it('asking price outside the range never rejects a lead: informational only', () => {
    const s = screenBuyBox({ ...lead, askingPrice: 175_000 }, avatar)
    expect(s.overall).toBe('pass')
    expect(s.criteria.find((c) => c.label === 'Asking price')).toMatchObject({
      result: 'info',
      detail: '$175,000 — outside the buy-box price range $80,000–$150,000 (informational; see feasibility)',
    })
    // An unknown asking price does not make the screen incomplete either.
    expect(screenBuyBox({ ...lead, askingPrice: null }, avatar).overall).toBe('pass')
  })
  it('a missing fact is UNKNOWN (incomplete), never a pass or a fail', () => {
    const s = screenBuyBox({ ...lead, sqft: null, estRent: null }, avatar)
    expect(s.overall).toBe('incomplete')
    expect(s.criteria.find((c) => c.label === 'Square feet')!.result).toBe('unknown')
  })
  it('a fail beats unknowns; no avatar → no buy box; unbounded criteria are skipped', () => {
    expect(screenBuyBox({ ...lead, sqft: null, beds: 5 }, avatar).overall).toBe('fail')
    expect(screenBuyBox(lead, null).overall).toBe('no_buy_box')
    const open = { ...avatar, sqftMin: null, sqftMax: null, rentMin: null }
    expect(screenBuyBox({ ...lead, sqft: null, estRent: null }, open).overall).toBe('pass')
  })
})

describe('lead feasibility = the Deal Analyzer engine at the asking and target prices', () => {
  it('matches analyzeDeal on the same inputs (no duplicated formula)', () => {
    const f = leadFeasibility(lead, {})
    const ref = analyzeDeal({
      ...emptyInputs(),
      propertyType: 'SFR', beds: 3, baths: 1, sqft: 1_200, yearBuilt: 1955, askingPrice: 120_000, purchasePrice: 120_000,
      rehabEstimate: 40_000, arvBase: 200_000, marketRent: 1_500,
    })
    expect(leadInputs(lead, {}).purchasePrice).toBe(120_000)
    expect(f.atAsking.allIn).toBe(ref.base.totalProjectCost)
    expect(f.atAsking.incomplete).toBe(true) // no closing %, financing etc. without defaults
  })
  it('gap in $ and %: positive = asking above what the target allows', () => {
    const f = leadFeasibility(lead, {})
    const mo = f.atAsking.maxOffer.base as number
    expect(f.atAsking.gapUsd).toBe(lead.askingPrice - mo)
    expect(f.atAsking.gapPct).toBeCloseTo((lead.askingPrice - mo) / lead.askingPrice, 12)
    expect(leadFeasibility({ ...lead, estArv: null }, {}).atAsking.maxOffer.base).toBeNull() // UNKNOWN, never 0
  })
  it('target = our latest offer when one is recorded, else the base Max Offer', () => {
    const f = leadFeasibility(lead, {})
    expect(f.targetSource).toBe('base Max Offer')
    expect(f.atTarget.price).toBe(f.atAsking.maxOffer.base)
    const g = leadFeasibility(lead, {}, 95_000)
    expect(g.targetSource).toBe('latest offer')
    expect(g.atTarget.price).toBe(95_000)
  })
  it('missing estimates are listed', () => {
    expect(leadFeasibility({ ...lead, estRent: null, askingPrice: null }, {}).missing).toEqual(['askingPrice', 'marketRent'])
  })
})

describe('lead quality', () => {
  it("a lead's own figures are estimates, never verified", () => {
    const q = leadQuality({ ...lead, source: 'Wholesaler email', estRehab: null }, screenBuyBox(lead, avatar))
    expect(q.fit).toBe('pass')
    expect(q.evidence.map((e) => e.status)).toEqual(['estimate', 'estimate', 'missing'])
    expect(q.evidence[0].detail).toContain('Wholesaler email')
    expect([q.factsKnown, q.factsTotal]).toEqual([5, 5])
  })
})

describe('lead priority order (an ordering, not a threshold)', () => {
  const f = (askingPct: number | null) => ({ atAsking: { gapPct: askingPct } }) as unknown as Parameters<typeof priorityCompare>[0]
  it('smallest required discount off asking first; unknown gaps (and no check) last', () => {
    const list = [f(0.3), f(null), f(-0.05), f(0.1), null]
    const sorted = [...list].sort(priorityCompare)
    expect(sorted.slice(0, 3)).toEqual([list[2], list[3], list[0]])
    expect(sorted.slice(3)).toEqual(expect.arrayContaining([list[1], null]))
  })
})

describe('lead intake', () => {
  it('address key: same property, different spelling → same key', () => {
    expect(addressKey('12 Main Street, Apt. 3', '75216-1234')).toBe('12 main st apt 3|75216')
    expect(addressKey('12  MAIN ST APT 3', '75216')).toBe(addressKey('12 Main Street, Apt. 3', '75216-1234'))
    expect(addressKey('12 Main St', '75217')).not.toBe(addressKey('12 Main St', '75216'))
  })
  it('CSV with quotes, commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,2')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']])
  })
  it('import: blank → UNKNOWN, $ and , parsed, bad rows reported by line, fallback source', () => {
    const csv = 'Address,ZIP,Property Type,Beds,Asking Price,Est ARV,Source\n12 Main St,75216,sfr,3,"$110,000",,\n,75216,SFR,3,1,,\n9 Oak Ave,75216,Castle,x,1,,Agent'
    const { rows, error } = parseLeadsCsv(csv, 'County list')
    expect(error).toBeUndefined()
    expect(rows[0].lead).toMatchObject({ address: '12 Main St', propertyType: 'SFR', askingPrice: 110_000, estArv: null, source: 'County list' })
    expect(rows[1]).toMatchObject({ line: 3, lead: null })
    expect(rows[1].errors.address).toBeDefined()
    expect(rows[2].errors).toMatchObject({ propertyType: expect.stringMatching(/Castle/), beds: 'Not a number' })
  })
  it('refuses a file without an address column or with too many rows', () => {
    expect(parseLeadsCsv('zip\n75216', 's').error).toMatch(/address/)
    expect(parseLeadsCsv('address\n' + 'x\n'.repeat(501), 's').error).toMatch(/500/)
  })
})

describe('funnel', () => {
  it('counts each layer per market', () => {
    const rows = buildFunnel(
      [{ marketId: 'm1', status: 'active' }, { marketId: 'm1', status: 'closed' }],
      [
        { marketId: 'm1', targetId: 't', status: 'new', screen: 'pass', deal: null },
        { marketId: 'm1', targetId: 't', status: 'rejected', screen: 'fail', deal: null },
        { marketId: 'm1', targetId: 't', status: 'handed_off', screen: 'incomplete', deal: { status: 'Closed', recommendation: 'BUY', hasOutcome: true } },
      ],
    )
    expect(rows).toEqual([
      { marketId: 'm1', targets: 1, leads: 3, screenPass: 1, screenIncomplete: 1, screenFail: 1, rejected: 1, handedOff: 1, buy: 1, investigate: 0, pass: 0, closed: 1, outcomes: 1 },
    ])
  })
})

describe('hand-off contract (layer 4 → 5)', () => {
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
