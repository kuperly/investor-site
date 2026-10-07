import { beforeAll, describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { getDb, type Db } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { listSnapshots } from '@/lib/deal-snapshots'
import { rankedGeo } from '../engine/fixtures'
import type { Geography } from '../engine/types'
import { recordManualObservation, runIngestion } from '../ingest/pipeline'
import type { MarketDataProvider } from '../ingest/types'
import { candidatesRepo, geoRepo, observationsRepo, outcomesRepo, samplesRepo } from './repo'
import { canAddChild, evaluateAll, handOff, marketRows, promote } from './service'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

const TODAY = '2026-10-07'
// Unique 5-digit codes per run so the suite is safe on a persistent TEST_DATABASE_URL.
const base = 10_000 + (Date.now() % 80_000)
const code = (i: number) => String(base + i).padStart(5, '0').slice(-5)

const fakeProvider = (values: { metric: string; value: number; asOf?: string }[]): MarketDataProvider => ({
  id: 'fake',
  name: 'Fake provider',
  description: '',
  homepage: '',
  levels: ['msa', 'zcta'],
  env: [],
  version: 'fake/1',
  fetch: async () => ({
    observations: values.map((v) => ({ metric: v.metric, value: v.value, unit: v.metric === 'acs.median_gross_rent' ? 'usd_month' : 'count', source: 'Fake', sourceUrl: null, asOf: v.asOf ?? '2024-12-31', confidence: 'official_primary', methodology: 'test' })),
    payloads: [{ raw: true }],
    requests: ['https://example.test/?key=REDACTED'],
    warnings: [],
  }),
})

describe(`VF-03 data layer (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  let db: Db
  const msaIds: string[] = []
  beforeAll(async () => {
    db = await getDb()
    for (let i = 0; i < 6; i++) msaIds.push(await geoRepo(db).create({ level: 'msa', code: code(i), name: `Test MSA ${i}`, parentId: null, state: 'TX' }, 'Guy'))
  })

  it('enforces the geography hierarchy and official codes', async () => {
    const geos = geoRepo(db)
    await expect(geos.create({ level: 'msa', code: 'Dallas', name: 'Bad', parentId: null, state: null }, 'Guy')).rejects.toThrow(/official code/)
    await expect(geos.create({ level: 'zcta', code: '75001', name: 'Orphan ZIP', parentId: null, state: null }, 'Guy')).rejects.toThrow(/needs a parent/)
    const sub = await geos.create({ level: 'submarket', code: null, name: 'North', parentId: msaIds[0], state: null }, 'Guy')
    await expect(geos.create({ level: 'tract', code: '48113010101', name: 'Tract', parentId: sub, state: null }, 'Guy')).rejects.toThrow(/cannot sit under/)
    expect(sub).toMatch(/^submarket:[0-9a-f-]{36}$/)
    expect((await geos.get(sub))!.state).toBe('TX') // inherited from the MSA
  })

  it('ingestion: validates, stores rejected values with reasons (never 0), skips duplicates, never overwrites', async () => {
    const geo = (await geoRepo(db).get(msaIds[0]))!
    const p = fakeProvider([
      { metric: 'acs.median_gross_rent', value: 1200 },
      { metric: 'acs.median_gross_rent', value: -666_666_666, asOf: '2019-12-31' },
      { metric: 'acs.population', value: 1_000_000 },
    ])
    const ctx = { fetch, env: {}, now: new Date(`${TODAY}T10:00:00Z`) }
    const r1 = await runIngestion(db, p, geo, 'Guy', ctx)
    expect(r1).toMatchObject({ status: 'partial', accepted: 2, rejected: 1, duplicates: 0 })
    expect(r1.errors.join(' ')).toMatch(/plausible range/)
    const r2 = await runIngestion(db, p, geo, 'Guy', ctx)
    expect(r2).toMatchObject({ accepted: 0, rejected: 0, duplicates: 3 })
    const all = await observationsRepo(db).forGeo(geo.id, { includeRejected: true })
    const rejected = all.find((o) => o.validationStatus === 'rejected')!
    expect(rejected.value).toBe(-666_666_666) // kept as received, flagged — never coerced to 0
    expect(rejected.validationErrors.length).toBe(1)
    await expect(db.query("update market_observations set value = 1 where geo_id = $1", [geo.id])).rejects.toThrow(/append-only/)
  })

  it('a provider without its key fails the run with a clear message', async () => {
    const geo = (await geoRepo(db).get(msaIds[0]))!
    const p = { ...fakeProvider([]), env: [{ name: 'NEEDED_KEY', required: true, help: '' }] }
    const r = await runIngestion(db, p, geo, 'Guy', { fetch, env: {}, now: new Date() })
    expect(r.status).toBe('failed')
    expect(r.errors[0]).toMatch(/NEEDED_KEY/)
  })

  it('manual evidence needs a source', async () => {
    const r = await recordManualObservation(
      db,
      { geoId: msaIds[1], metric: 'opp.foreclosure_per_1000', value: 3, unit: 'per_1000_units', source: '', sourceUrl: null, asOf: '2026-06-30', retrievedAt: `${TODAY}T00:00:00Z`, confidence: 'verified_local_commercial', methodology: 'Manual entry' },
      'Ben',
      TODAY,
    )
    expect(r.status).toBe('rejected')
    expect(r.errors[0]).toMatch(/source is required/)
  })

  it('conditional drill-down, snapshots, change detection', async () => {
    // Full synthetic evidence for six MSAs; MSA 5 is best on every metric.
    const repo = observationsRepo(db)
    for (let i = 0; i < 6; i++) {
      const g: Geography = (await geoRepo(db).get(msaIds[i]))!
      for (const o of rankedGeo(g, i, { asOf: '2026-09-01' }).observations) await repo.insert(o, { errors: [], methodologyVersion: 'test', runId: null, enteredBy: 'test' })
    }
    expect(await canAddChild(db, msaIds[5])).toBe(false)
    expect((await promote(db, msaIds[5], 'Guy')).error).toMatch(/Evaluate/)

    const run1 = await evaluateAll(db, 'Guy', TODAY)
    const best = run1.evaluations.find((e) => e.geoId === msaIds[5])!
    expect(best.decision.state).toBe('DRILL_DOWN')
    expect((await promote(db, msaIds[0], 'Guy')).error).toMatch(/Not eligible/)
    expect(await promote(db, msaIds[5], 'Guy')).toEqual({})
    expect(await canAddChild(db, msaIds[5])).toBe(true)

    const zip = await geoRepo(db).create({ level: 'zcta', code: code(50), name: 'Test ZIP', parentId: msaIds[5], state: 'TX' }, 'Guy')
    const orphanSub = await geoRepo(db).create({ level: 'submarket', code: null, name: 'Not promoted', parentId: msaIds[1], state: null }, 'Guy')
    const run2 = await evaluateAll(db, 'Guy', TODAY)
    expect(run2.evaluations.some((e) => e.geoId === zip)).toBe(true)
    expect(run2.skipped.some((s) => s.geo.id === orphanSub)).toBe(true)
    expect(run2.evaluations.find((e) => e.geoId === msaIds[5])!.decision.state).toBe('KEEP') // promoted → KEEP

    const rows = await marketRows(db)
    const row = rows.find((r) => r.geo.id === msaIds[5])!
    expect(row.latest!.decision).toBe('KEEP')
    expect(row.change!.decision).toEqual({ from: 'DRILL_DOWN', to: 'KEEP' })
    expect(row.promoted).toBe(true)
  })

  it('capital efficiency comes from Deal Analyzer runs of samples', async () => {
    await samplesRepo(db).add({ geoId: msaIds[2], label: 'Typical 3/1', kind: 'assumption', dealId: null, inputs: sampleInputs(), source: 'Local agent', sourceUrl: null, confidence: 'single_secondary', asOf: '2026-09-01' }, 'Ben')
    const run = await evaluateAll(db, 'Ben', TODAY)
    const e = run.evaluations.find((x) => x.geoId === msaIds[2])!
    expect(e.evidence['ce.capital_recycled'].source).toMatch(/Deal Analyzer on 1 sample: Typical 3\/1/)
    expect(e.evidence['ce.capital_recycled'].confidence).toBe('single_secondary')
  })

  it('hand-off creates a Deal Analyzer deal (facts only), links both ways, and is idempotent', async () => {
    const zip = (await geoRepo(db).list({ level: 'zcta', parentId: msaIds[5] }))[0]
    const cid = await candidatesRepo(db).create(
      { geoId: zip.id, avatarId: null, address: `${base} Hand-off St`, city: 'Dallas', state: 'TX', zip: zip.code, propertyType: 'SFR', beds: 3, baths: 1, sqft: 1200, yearBuilt: 1960, askingPrice: 120_000, condition: 'Dated', estArv: 210_000, estRehab: 40_000, estRent: 1_500, source: 'Driving for dollars', sourceUrl: null, notes: null },
      'Ben',
    )
    const c = (await candidatesRepo(db).get(cid))!
    const r = await handOff(db, cid, c.version, 'Ben')
    expect(r.dealId).toBeDefined()
    const deal = (await dealsRepo(db).get(r.dealId!))!
    expect(deal.inputs).toMatchObject({ address: `${base} Hand-off St`, askingPrice: 120_000, beds: 3, arvBase: null, rehabEstimate: null, marketRent: null, purchasePrice: null })
    expect(deal.notes.general).toMatch(/NOT applied/)
    const [link] = await db.query<{ source_candidate_id: string }>('select source_candidate_id from deals where id = $1', [r.dealId])
    expect(link.source_candidate_id).toBe(cid)
    expect((await candidatesRepo(db).get(cid))!).toMatchObject({ status: 'handed_off', dealId: r.dealId })
    expect(await listSnapshots(db, r.dealId!)).toHaveLength(1)
    expect(await handOff(db, cid, c.version, 'Ben')).toEqual({ dealId: r.dealId }) // already handed off → same deal

    // Feedback loop: actual result next to the predicted snapshot.
    const [snap] = await listSnapshots(db, r.dealId!)
    await outcomesRepo(db).save(r.dealId!, { candidateId: cid, geoId: zip.id, avatarId: null, predictedSnapshotId: snap.id, propertyType: 'SFR', purchasePrice: 115_000, arv: 205_000, rehab: 45_000, rent: 1_450, timelineMonths: 7, exitStrategy: 'BRRRR', actualProfit: null, actualAnnualCashFlow: 2_400, actualRefiLoan: 150_000, actualCapitalRecovered: 52_000, notes: null }, 'Guy')
    const o = (await outcomesRepo(db).get(r.dealId!))!
    expect(o).toMatchObject({ purchasePrice: 115_000, actualProfit: null, predictedSnapshotId: snap.id, version: 1 })
    await expect(outcomesRepo(db).save(r.dealId!, { ...o, actualProfit: 10_000 }, 'Ben', 99)).rejects.toThrow(/changed by someone else/)
    expect((await dealsRepo(db).audit(r.dealId!)).some((a) => a.field === 'outcome')).toBe(true)
  })
})
