import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDb, splitSql } from './db'
import { checksum, loadMigrations, migrationStatus, runMigrations } from './migrations'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

const dir = path.join(process.cwd(), 'db', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

describe('db/migrations/*.sql', () => {
  it.each(files)('%s has no ";" inside an inline -- comment (the splitter cuts on ";")', (f) => {
    const sql = readFileSync(path.join(dir, f), 'utf8')
    const bad = sql.split('\n').filter((l) => l.includes('--') && l.slice(l.indexOf('--')).includes(';') && !l.trim().startsWith('--'))
    expect(bad).toEqual([])
  })
  it.each(files)('%s splits into statements with no comment fragments', (f) => {
    for (const stmt of splitSql(readFileSync(path.join(dir, f), 'utf8'))) expect(stmt).toMatch(/^(create|alter|insert|update|drop)\s/i)
  })
  it('versions run 1..n with no gaps', async () => {
    const ms = await loadMigrations()
    expect(ms.map((m) => m.version)).toEqual(ms.map((_, i) => i + 1))
  })
})

describe(`migration runner (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  it('applies every migration once at startup and records it with a checksum', async () => {
    const db = await getDb()
    const status = await migrationStatus(db)
    const ms = await loadMigrations()
    expect(status.map((s) => s.version)).toEqual(ms.map((m) => m.version))
    // Running again is a no-op.
    expect((await runMigrations(db, ms)).applied).toEqual([])
  })

  it('refuses to start when an applied migration was edited', async () => {
    const db = await getDb()
    const ms = await loadMigrations()
    const edited = ms.map((m) => (m.version === 1 ? { ...m, sql: m.sql + '\n-- edited' } : m))
    await expect(runMigrations(db, edited)).rejects.toThrow(/edited after it was applied/)
  })

  it('refuses to run an older build against a newer database', async () => {
    const db = await getDb()
    const ms = await loadMigrations()
    await expect(runMigrations(db, ms.slice(0, 1))).rejects.toThrow(/does not know/)
  })

  it('checksum ignores CRLF vs LF', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'))
  })

  it('transactions roll back everything on error', async () => {
    const db = await getDb()
    const key = `tx-test-${Date.now()}`
    await expect(
      db.transaction(async (tx) => {
        await tx.query(`insert into settings (key, value, updated_by) values ($1, '{}'::jsonb, 'test')`, [key])
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await db.query('select 1 from settings where key = $1', [key])).toEqual([])
  })
})
