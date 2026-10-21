import { beforeAll, describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { emptyInputs } from '@/engine/fields'
import { getDb } from './db'
import { DealConflictError, dealsRepo } from './deals-repo'
import { listSnapshots, snapshotDeal } from './deal-snapshots'

// Uses in-memory PGlite by default; set TEST_DATABASE_URL to run against a real PostgreSQL/Supabase.
process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

describe(`deals repository (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  let repo: ReturnType<typeof dealsRepo>
  beforeAll(async () => {
    repo = dealsRepo(await getDb())
  })

  it('AC15: creates and reads back a deal with UNKNOWN preserved as null', async () => {
    const inputs = { ...emptyInputs(), address: '9 Unknown Ave', purchasePrice: 90_000 }
    const id = await repo.create(inputs, { general: 'first look' }, 'Lead', 'Guy')
    const d = await repo.get(id)
    expect(d?.inputs.purchasePrice).toBe(90_000)
    expect(d?.inputs.insuranceAnnual).toBeNull()
    expect(d?.notes.general).toBe('first look')
    expect(d?.createdBy).toBe('Guy')
  })

  it('AC16 + §33: editing writes an audit row per changed field', async () => {
    const id = await repo.create(sampleInputs({ purchasePrice: 125_000 }), {}, 'Lead', 'Guy')
    const n = await repo.update(id, { inputs: sampleInputs({ purchasePrice: 115_000 }), status: 'Offer' }, 'Ben')
    expect(n).toBe(2)
    const d = await repo.get(id)
    expect(d?.inputs.purchasePrice).toBe(115_000)
    expect(d?.status).toBe('Offer')
    expect(d?.updatedBy).toBe('Ben')
    const audit = await repo.audit(id)
    const price = audit.find((a) => a.field === 'purchasePrice')!
    expect(price).toMatchObject({ oldValue: 125_000, newValue: 115_000, changedBy: 'Ben' })
    expect(audit.some((a) => a.field === 'status' && a.newValue === 'Offer')).toBe(true)
  })

  it('no-op saves write no audit rows', async () => {
    const id = await repo.create(sampleInputs(), {}, 'Lead', 'Guy')
    expect(await repo.update(id, { inputs: sampleInputs() }, 'Guy')).toBe(0)
  })

  it('filters by market / zip / status', async () => {
    // Unique per run so the test is safe against a persistent TEST_DATABASE_URL.
    const tag = `Filter ${Date.now()}`
    const zip = String(Date.now()).slice(-5)
    await repo.create(sampleInputs({ address: 'A', market: tag, zip }), {}, 'Analyzing', 'Guy')
    expect((await repo.list({ market: tag })).map((d) => d.inputs.address)).toEqual(['A'])
    expect((await repo.list({ market: tag, zip, status: 'Analyzing' })).length).toBe(1)
    expect((await repo.list({ market: tag, status: 'Closed' })).length).toBe(0)
    expect(await repo.distinct('market')).toContain(tag)
  })

  it('stores inputs/notes/audit values as real jsonb (queryable in SQL)', async () => {
    const id = await repo.create(sampleInputs({ insuranceAnnual: 1_234 }), { general: 'n' }, 'Lead', 'Guy')
    await repo.update(id, { inputs: sampleInputs({ insuranceAnnual: 1_500 }) }, 'Guy')
    const db = await getDb()
    const [row] = await db.query<{ t: string; ins: string; nt: string }>(
      `select jsonb_typeof(inputs) as t, inputs->>'insuranceAnnual' as ins, jsonb_typeof(notes) as nt from deals where id = $1`,
      [id],
    )
    expect(row).toEqual({ t: 'object', ins: '1500', nt: 'object' })
    const [a] = await db.query<{ t: string }>(
      `select jsonb_typeof(new_value) as t from deal_audit where deal_id = $1 and field = 'insuranceAnnual'`,
      [id],
    )
    expect(a.t).toBe('number')
  })

  it('optimistic locking: a save based on an old version is refused and changes nothing', async () => {
    const id = await repo.create(sampleInputs({ purchasePrice: 100_000 }), {}, 'Lead', 'Guy')
    expect((await repo.get(id))!.version).toBe(1)
    // Ben saves first (based on version 1) → version 2.
    expect(await repo.update(id, { inputs: sampleInputs({ purchasePrice: 101_000 }) }, 'Ben', { expectedVersion: 1 })).toBe(1)
    expect((await repo.get(id))!.version).toBe(2)
    // Guy's form was also opened at version 1.
    const err = await repo.update(id, { inputs: sampleInputs({ purchasePrice: 99_000 }) }, 'Guy', { expectedVersion: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(DealConflictError)
    expect(err.updatedBy).toBe('Ben')
    expect((await repo.get(id))!.inputs.purchasePrice).toBe(101_000)
    expect((await repo.audit(id)).filter((a) => a.field === 'purchasePrice')).toHaveLength(1)
    // A no-op save keeps the version.
    expect(await repo.update(id, { inputs: sampleInputs({ purchasePrice: 101_000 }) }, 'Guy', { expectedVersion: 2 })).toBe(0)
    expect((await repo.get(id))!.version).toBe(2)
  })

  it('a failure inside the save transaction leaves neither the change nor its audit rows', async () => {
    const id = await repo.create(sampleInputs({ purchasePrice: 100_000 }), {}, 'Lead', 'Guy')
    const db = await getDb()
    await expect(
      db.transaction(async (tx) => {
        await dealsRepo(tx).update(id, { inputs: sampleInputs({ purchasePrice: 90_000 }) }, 'Guy')
        throw new Error('snapshot failed')
      }),
    ).rejects.toThrow('snapshot failed')
    expect((await repo.get(id))!.inputs.purchasePrice).toBe(100_000)
    expect((await repo.audit(id)).some((a) => a.field === 'purchasePrice')).toBe(false)
  })

  it('stores analysis snapshots with the engine version, unchanged by later edits', async () => {
    const db = await getDb()
    const id = await repo.create(sampleInputs(), {}, 'Lead', 'Guy')
    await snapshotDeal(db, id, 'Guy')
    await repo.update(id, { inputs: sampleInputs({ purchasePrice: 1 }) }, 'Ben')
    await snapshotDeal(db, id, 'Ben')
    const [latest, first] = await listSnapshots(db, id)
    expect(first.summary.allIn).not.toBe(latest.summary.allIn)
    expect(first).toMatchObject({ createdBy: 'Guy', dealVersion: 1, engineVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/) })
    expect(latest).toMatchObject({ createdBy: 'Ben', dealVersion: 2 })
    expect(['BUY', 'INVESTIGATE', 'PASS']).toContain(first.summary.recommendation)
  })

  it('rejects malformed ids without querying', async () => {
    expect(await repo.get("'; drop table deals; --")).toBeNull()
  })
})
