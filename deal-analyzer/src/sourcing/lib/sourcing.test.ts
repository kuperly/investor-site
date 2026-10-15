import { beforeAll, describe, expect, it } from 'vitest'
import { getDb, type Db } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { listSnapshots } from '@/lib/deal-snapshots'
import { rankedGeo } from '@/market/engine/fixtures'
import { avatarsRepo, geoRepo, observationsRepo, outcomesRepo } from '@/market/lib/repo'
import { evaluateAll } from '@/market/lib/service'
import { candidatesRepo, negotiationRepo, targetsRepo } from './repo'
import { addLead, handOff, importLeads, latestDecision, openTarget, pipeline, recordNegotiation } from './service'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

const TODAY = '2026-10-09'
const base = 10_000 + ((Date.now() + 37_000) % 80_000)
const code = (i: number) => String(base + i).padStart(5, '0').slice(-5)
const lead = (address: string, extra: Record<string, unknown> = {}) => ({
  address, city: 'Testville', state: 'TX', zip: code(90), propertyType: 'SFR' as const, beds: 3, baths: 1, sqft: 1_200, yearBuilt: 1955,
  askingPrice: 120_000, condition: null, estArv: 200_000, estRehab: 40_000, estRent: 1_500, source: 'Test list', sourceUrl: null, notes: null, ...extra,
})

describe(`Deal Sourcing layer (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  let db: Db
  const msa: string[] = []
  let avatarId: string
  beforeAll(async () => {
    db = await getDb()
    for (let i = 0; i < 6; i++) {
      const id = await geoRepo(db).create({ level: 'msa', code: code(i), name: `Sourcing MSA ${i}`, parentId: null, state: 'TX' }, 'Guy')
      msa.push(id)
      for (const o of rankedGeo((await geoRepo(db).get(id))!, i, { asOf: '2026-09-01' }).observations)
        await observationsRepo(db).insert(o, { errors: [], methodologyVersion: 'test', runId: null, enteredBy: 'test' })
    }
    await evaluateAll(db, 'Guy', TODAY)
    avatarId = await avatarsRepo(db).save(
      {
        name: `Sourcing avatar ${base}`, description: '', propertyTypes: ['sfh_detached'], bedsMin: 3, bedsMax: 3, yearBuiltMin: 1940, yearBuiltMax: 1980, sqftMin: null, sqftMax: null,
        purchaseMin: 80_000, purchaseMax: 150_000, arvMin: null, arvMax: null, rentMin: 1_400, rehabMin: null, rehabMax: null, strategies: ['brrrr'], active: true,
      },
      'Guy',
    )
  }, 30_000) // evaluateAll scores every geography in the (possibly persistent) test DB

  it('layer 2 → 3: targets follow the market decision', async () => {
    const decisions = await Promise.all(msa.map((id) => latestDecision(db, id)))
    const by = (d: string) => msa[decisions.findIndex((x) => x?.decision === d)]
    expect(await openTarget(db, { geoId: by('DROP'), avatarId, reason: null, notes: null }, 'Guy')).toMatchObject({ error: expect.stringMatching(/DROP/) })
    const watch = by('WATCH')
    expect((await openTarget(db, { geoId: watch, avatarId, reason: '  ', notes: null }, 'Guy')).error).toMatch(/reason/)
    expect((await openTarget(db, { geoId: watch, avatarId, reason: 'Local partner on the ground', notes: null }, 'Guy')).ok).toBeDefined()
    const ok = await openTarget(db, { geoId: by('DRILL_DOWN'), avatarId, reason: null, notes: null }, 'Guy')
    expect(ok.ok).toBeDefined()
    expect((await openTarget(db, { geoId: by('DRILL_DOWN'), avatarId, reason: null, notes: null }, 'Guy')).error).toMatch(/already an open target/)
    const unevaluated = await geoRepo(db).create({ level: 'msa', code: code(40), name: 'Not evaluated', parentId: null, state: 'TX' }, 'Guy')
    expect((await openTarget(db, { geoId: unevaluated, avatarId, reason: null, notes: null }, 'Guy')).error).toMatch(/Evaluate/)
    expect((await targetsRepo(db).get(ok.ok!.id))!).toMatchObject({ gateDecision: 'DRILL_DOWN', status: 'active' })
  })

  it('layer 3 → 4: leads are screened on entry, duplicates refused, paused targets closed to intake', async () => {
    const [t] = await targetsRepo(db).list({ status: 'active' })
    const a = await addLead(db, t.id, lead(`${base} Fit St`), 'Ben')
    expect((await candidatesRepo(db).get(a.ok!.id))!.screening!.overall).toBe('pass')
    // Asking price outside the buy box is informational: the lead is not rejected.
    const p = await addLead(db, t.id, lead(`${base} Pricey St`, { askingPrice: 175_000 }), 'Ben')
    expect((await candidatesRepo(db).get(p.ok!.id))!.screening!.overall).toBe('pass')
    const b = await addLead(db, t.id, lead(`${base} Big St`, { askingPrice: 175_000, beds: 5 }), 'Ben')
    expect((await candidatesRepo(db).get(b.ok!.id))!.screening!.overall).toBe('fail')
    expect((await addLead(db, t.id, lead(`${base} FIT STREET`), 'Ben')).error).toMatch(/Already in the pipeline/)
    await targetsRepo(db).setStatus(t.id, 'paused', t.version, 'Guy')
    expect((await addLead(db, t.id, lead(`${base} Late Rd`), 'Ben')).error).toMatch(/paused/)
    const t2 = (await targetsRepo(db).get(t.id))!
    await targetsRepo(db).setStatus(t.id, 'active', t2.version, 'Guy')
  })

  it('CSV import: adds new rows in one go, reports duplicates and invalid rows by line', async () => {
    const [t] = await targetsRepo(db).list({ status: 'active' })
    const csv = `address,zip,property_type,beds,asking_price\n${base} Csv One,${code(90)},SFR,3,100000\n${base} Fit St,${code(90)},SFR,3,1\n,${code(90)},SFR,3,1\n${base} Csv One,${code(90)},SFR,3,100000`
    const r = await importLeads(db, t.id, csv, 'County list', 'Ben')
    expect(r.ok!.added).toBe(1)
    expect(r.ok!.duplicates.map((d) => d.line)).toEqual([3, 5])
    expect(r.ok!.invalid.map((d) => d.line)).toEqual([4])
  })

  it('layer 4 → 5: a failed screen needs a reason; the deal links back; feedback reaches the pipeline', async () => {
    const leads = await candidatesRepo(db).list({ status: 'new' })
    const failed = leads.find((l) => l.screening?.overall === 'fail')!
    expect((await handOff(db, failed.id, failed.version, 'Ben')).error).toMatch(/reason/)
    const r = await handOff(db, failed.id, failed.version, 'Ben', 'Seller will negotiate below $150K')
    const deal = (await dealsRepo(db).get(r.dealId!))!
    expect(deal.inputs).toMatchObject({ askingPrice: 175_000, arvBase: null, purchasePrice: null })
    expect(deal.notes.general).toMatch(/Sent despite a failed buy-box screen: Seller will negotiate/)
    expect((await candidatesRepo(db).get(failed.id))!).toMatchObject({ status: 'handed_off', dealId: r.dealId, overrideReason: 'Seller will negotiate below $150K' })
    expect(await handOff(db, failed.id, failed.version, 'Ben')).toEqual({ dealId: r.dealId }) // idempotent
    const [snap] = await listSnapshots(db, r.dealId!)
    await outcomesRepo(db).save(r.dealId!, { candidateId: failed.id, geoId: failed.geoId, avatarId, predictedSnapshotId: snap.id, propertyType: 'SFR', purchasePrice: 140_000, arv: null, rehab: null, rent: null, timelineMonths: null, exitStrategy: null, actualProfit: null, actualAnnualCashFlow: null, actualRefiLoan: null, actualCapitalRecovered: null, notes: null }, 'Guy')

    const p = await pipeline(db)
    const row = p.rows.find((x) => x.marketId === failed.geoId)!
    expect(row).toMatchObject({ handedOff: 1, outcomes: 1, screenFail: 1 })
    expect(row.leads).toBeGreaterThanOrEqual(3)
    expect(p.targets.find((t) => t.id === failed.targetId)!.leads).toBe(row.leads)
  })
  it('negotiation log: facts on a lead, shown on its deal too, append-only, validated', async () => {
    const [t] = await targetsRepo(db).list({ status: 'active' })
    const l = await addLead(db, t.id, lead(`${base} Offer Ave`), 'Ben')
    const id = l.ok!.id
    const ev = (kind: 'our_offer' | 'seller_counter' | 'price_cut' | 'lost', amount: number | null, eventDate: string, note: string | null = null) =>
      recordNegotiation(db, { candidateId: id, dealId: null, kind, amount, eventDate, note }, 'Ben', TODAY)
    expect((await ev('our_offer', null, '2026-10-01')).error).toMatch(/needs an amount/)
    expect((await ev('our_offer', 90_000, '2026-10-20')).error).toMatch(/future/)
    expect((await recordNegotiation(db, { candidateId: null, dealId: null, kind: 'no_response', amount: null, eventDate: TODAY, note: null }, 'Ben', TODAY)).error).toMatch(/lead or a deal/)
    expect((await ev('price_cut', 110_000, '2026-09-20')).ok).toBeDefined()
    expect((await ev('our_offer', 90_000, '2026-10-01')).ok).toBeDefined()
    expect((await ev('seller_counter', 104_000, '2026-10-03')).ok).toBeDefined()
    const events = await negotiationRepo(db).list({ candidateId: id })
    expect(events.map((e) => [e.kind, e.amount, e.eventDate])).toEqual([
      ['price_cut', 110_000, '2026-09-20'],
      ['our_offer', 90_000, '2026-10-01'],
      ['seller_counter', 104_000, '2026-10-03'],
    ])
    // The lead's original asking is never overwritten by a price cut.
    expect((await candidatesRepo(db).get(id))!.askingPrice).toBe(120_000)
    // Append-only at the database level.
    await expect(db.query(`update negotiation_events set amount = 1 where id = $1`, [events[0].id])).rejects.toThrow(/append-only/)
    // After hand-off the deal sees the lead's history plus its own events.
    const c = (await candidatesRepo(db).get(id))!
    const r = await handOff(db, id, c.version, 'Ben')
    expect((await recordNegotiation(db, { candidateId: null, dealId: r.dealId!, kind: 'lost', amount: null, eventDate: TODAY, note: 'Sold to a cash buyer' }, 'Ben', TODAY)).ok).toBeDefined()
    const onDeal = await negotiationRepo(db).list({ candidateId: id, dealId: r.dealId! })
    expect(onDeal.map((e) => e.kind)).toEqual(['price_cut', 'our_offer', 'seller_counter', 'lost'])
  })
})
