import { beforeAll, describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { getDb } from './db'
import { compsRepo } from './comps-repo'
import { parseComp } from './comps/parse-comp'
import { dealsRepo } from './deals-repo'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

const form = (v: Record<string, string>) => (k: string) => v[k] ?? null

describe('parseComp', () => {
  const today = new Date('2026-10-04T00:00:00Z')
  it('blank → UNKNOWN (null), $ and commas accepted', () => {
    const { comp, errors } = parseComp(form({ address: '12 Oak St', salePrice: '$210,000', sqft: '' }), today)
    expect(errors).toEqual({})
    expect(comp.salePrice).toBe(210_000)
    expect(comp.sqft).toBeNull()
    expect(comp.renovation).toBeNull()
    expect(comp.included).toBe(true)
  })
  it('unknown tier falls back to standard; unknown status stays null', () => {
    const { comp } = parseComp(form({ address: 'x', tier: 'hacked', saleStatus: 'closed??' }), today)
    expect(comp.tier).toBe('standard')
    expect(comp.saleStatus).toBeNull()
  })
  it('% override: Super comps only, 0 < % ≤ 100, stored as a fraction', () => {
    expect(parseComp(form({ address: 'x', tier: 'superComp', shareOverridePct: '35' }), today).comp.shareOverride).toBe(0.35)
    expect(parseComp(form({ address: 'x', tier: 'bestFit', shareOverridePct: '35' }), today).errors.shareOverride).toMatch(/Only Super comps/)
    expect(parseComp(form({ address: 'x', tier: 'superComp', shareOverridePct: '120' }), today).errors.shareOverride).toMatch(/up to 100/)
    expect(parseComp(form({ address: 'x', tier: 'superComp', shareOverridePct: '0' }), today).errors.shareOverride).toMatch(/above 0/)
    expect(parseComp(form({ address: 'x', tier: 'superComp', shareOverridePct: '' }), today).comp.shareOverride).toBeNull()
  })
  it('validates address, numbers, dates and URLs', () => {
    const { errors } = parseComp(
      form({ salePrice: 'abc', sqft: '1200.5', saleDate: '2027-01-01', sourceUrl: 'javascript:alert(1)', distanceMiles: '-1' }),
      today,
    )
    expect(Object.keys(errors).sort()).toEqual(['address', 'distanceMiles', 'saleDate', 'salePrice', 'sourceUrl', 'sqft'])
  })
})

describe('comps repository', () => {
  let comps: ReturnType<typeof compsRepo>
  let deals: ReturnType<typeof dealsRepo>
  let dealId: string
  beforeAll(async () => {
    const db = await getDb()
    comps = compsRepo(db)
    deals = dealsRepo(db)
    dealId = await deals.create(sampleInputs(), {}, 'Lead', 'Guy')
  })

  const c = (o: Record<string, string>) => parseComp(form({ address: 'A', ...o })).comp

  it('adds, lists (newest sale first) and round-trips every field', async () => {
    await comps.add(dealId, c({ address: '1 Old St', salePrice: '150000', saleDate: '2026-01-15' }), 'Guy')
    const id = await comps.add(
      dealId,
      c({
        address: '2 New St', salePrice: '210000', saleDate: '2026-08-02', sqft: '1400', beds: '3', baths: '1.5',
        distanceMiles: '0.4', condition: 'Fully renovated', renovation: 'renovated', saleStatus: 'sold', tier: 'superComp', shareOverridePct: '40', source: 'MLS',
        sourceUrl: 'https://example.com/listing', notes: 'n',
      }),
      'Ben',
    )
    const list = await comps.list(dealId)
    expect(list.map((x) => x.address)).toEqual(['2 New St', '1 Old St'])
    expect(list[0]).toMatchObject({
      id, saleDate: '2026-08-02', salePrice: 210_000, sqft: 1_400, baths: 1.5, distanceMiles: 0.4,
      renovation: 'renovated', saleStatus: 'sold', tier: 'superComp', shareOverride: 0.4, source: 'MLS', origin: 'manual', createdBy: 'Ben',
    })
    expect(list[1].sqft).toBeNull()
    expect(list[1]).toMatchObject({ saleStatus: null, tier: 'standard', shareOverride: null }) // defaults: status UNKNOWN, tier Standard
  })

  it('update and delete are audited with before/after snapshots', async () => {
    const id = await comps.add(dealId, c({ address: '3 Edit St', salePrice: '125000' }), 'Guy')
    await comps.update(dealId, id, c({ address: '3 Edit St', salePrice: '115000' }), 'Ben')
    expect((await comps.get(dealId, id))?.salePrice).toBe(115_000)
    await comps.remove(dealId, id, 'Ben')
    expect(await comps.get(dealId, id)).toBeNull()
    const audit = (await deals.audit(dealId)).filter((a) => a.field === 'comps')
    const edit = audit.find((a) => a.oldValue && a.newValue)!
    expect(edit).toMatchObject({ changedBy: 'Ben', oldValue: { salePrice: 125_000 }, newValue: { salePrice: 115_000 } })
    expect(audit.some((a) => a.newValue === null && (a.oldValue as { address: string }).address === '3 Edit St')).toBe(true)
  })

  it('cannot touch a comp through another deal', async () => {
    const otherDeal = await deals.create(sampleInputs(), {}, 'Lead', 'Guy')
    const id = await comps.add(dealId, c({ address: '4 Mine St' }), 'Guy')
    expect(await comps.remove(otherDeal, id, 'Guy')).toBe(false)
    expect(await comps.get(dealId, id)).not.toBeNull()
  })

  it('automated import validates, de-duplicates by external id and audits', async () => {
    const raw = [
      { externalId: 'mls-1', address: '10 Import Rd', salePrice: '199,000', saleDate: '2026-06-01', renovation: 'renovated' as const },
      { externalId: 'mls-2', address: '', salePrice: '1' }, // invalid: no address
    ]
    expect(await comps.importComps(dealId, 'MLS', raw, 'Guy')).toMatchObject({ added: 1, duplicates: 0, invalid: [{ externalId: 'mls-2' }] })
    expect(await comps.importComps(dealId, 'MLS', raw, 'Guy')).toMatchObject({ added: 0, duplicates: 1 })
    const imported = (await comps.list(dealId)).find((x) => x.externalId === 'mls-1')!
    expect(imported).toMatchObject({ origin: 'import', source: 'MLS', salePrice: 199_000 })
  })
})
