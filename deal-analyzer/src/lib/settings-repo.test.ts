import { beforeAll, describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { getDb } from './db'
import { dealsRepo } from './deals-repo'
import { parseDefaultsForm } from './parse-inputs'
import { settingsRepo } from './settings-repo'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

describe('settings repository (default assumptions)', () => {
  let repo: ReturnType<typeof settingsRepo>
  beforeAll(async () => {
    repo = settingsRepo(await getDb())
  })

  it('saves defaults and records each changed field with who changed it', async () => {
    const before = await repo.getDefaults()
    const tag = (Date.now() % 1000) / 1000 // unique value: safe on a persistent TEST_DATABASE_URL
    const n = await repo.saveDefaults({ ...before, vacancyPct: tag, managementPct: 0.1 }, 'Ben')
    expect(n).toBeGreaterThanOrEqual(1)
    expect((await repo.getDefaults()).vacancyPct).toBe(tag)
    const h = await repo.history(5)
    expect(h.find((x) => x.field === 'vacancyPct')).toMatchObject({ newValue: tag, changedBy: 'Ben' })
    expect(await repo.saveDefaults(await repo.getDefaults(), 'Ben')).toBe(0) // no-op → no history
  })

  it('form parsing: blank = no default, percents → decimals, errors reported', () => {
    const f = (v: Record<string, string>) => (k: string) => v[k] ?? null
    expect(parseDefaultsForm(f({ vacancyPct: '8', hoaAnnual: '' })).defaults).toEqual({ vacancyPct: 0.08 })
    expect(parseDefaultsForm(f({ acqLtv: '150' })).errors.acqLtv).toMatch(/0 and 100/)
  })

  it('deals remember which inputs are unconfirmed defaults', async () => {
    const deals = dealsRepo(await getDb())
    const id = await deals.create(sampleInputs(), {}, 'Lead', 'Guy', ['vacancyPct', 'closingCostPct'])
    expect((await deals.get(id))?.defaulted).toEqual(['vacancyPct', 'closingCostPct'])
    await deals.setDefaulted(id, ['vacancyPct'])
    expect((await deals.get(id))?.defaulted).toEqual(['vacancyPct'])
  })
})
