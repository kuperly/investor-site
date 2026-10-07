/**
 * Versioned migrations: db/migrations/NNNN_name.sql, applied in order, each exactly once.
 *
 * - Applied migrations are recorded in `schema_migrations` with a SHA-256 checksum.
 *   Editing a file after it was applied stops startup (add a new migration instead).
 * - All pending migrations run in ONE transaction behind an advisory lock, so concurrent
 *   cold starts can't race and a failed migration leaves the database untouched.
 * - No ";" inside "--" comments: scripts are split into statements on ";" (see splitSql);
 *   $$-quoted function bodies are kept whole.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Db } from './db'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** Arbitrary constant for the migration advisory lock. */
const MIGRATION_LOCK_ID = 727_274_001

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/

export const migrationsDir = () => path.join(process.cwd(), 'db', 'migrations')

export async function loadMigrations(dir = migrationsDir()): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const out: Migration[] = []
  for (const f of files) {
    const m = FILE_RE.exec(f)
    if (!m) throw new Error(`Bad migration file name "${f}" (expected NNNN_snake_name.sql)`)
    out.push({ version: Number(m[1]), name: m[2], sql: await readFile(path.join(dir, f), 'utf8') })
  }
  out.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migration versions must be 1..n with no gaps (found ${m.version} at position ${i + 1})`)
  })
  return out
}

export const checksum = (sql: string) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')

export interface MigrationResult {
  applied: number[]
}

export async function runMigrations(db: Db, migrations: Migration[]): Promise<MigrationResult> {
  return db.transaction(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`)
    await tx.exec(`create table if not exists schema_migrations (
      version     integer primary key,
      name        text not null,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    )`)
    const rows = await tx.query<{ version: number; name: string; checksum: string }>(
      'select version, name, checksum from schema_migrations order by version',
    )
    const done = new Map(rows.map((r) => [Number(r.version), r]))
    for (const r of rows) {
      const m = migrations.find((x) => x.version === Number(r.version))
      if (!m) throw new Error(`Database has migration ${r.version} (${r.name}) that this build does not know — deploy the newer build`)
      if (checksum(m.sql) !== r.checksum)
        throw new Error(`Migration ${m.version}_${m.name} was edited after it was applied. Revert the edit and add a new migration.`)
    }
    const applied: number[] = []
    for (const m of migrations) {
      if (done.has(m.version)) continue
      await tx.exec(splitSql(m.sql).join(';\n') + ';')
      await tx.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3)', [m.version, m.name, checksum(m.sql)])
      applied.push(m.version)
    }
    return { applied }
  })
}

export async function migrationStatus(db: Db): Promise<{ version: number; name: string; appliedAt: Date }[]> {
  const rows = await db.query<{ version: number; name: string; applied_at: string }>(
    'select version, name, applied_at from schema_migrations order by version',
  )
  return rows.map((r) => ({ version: Number(r.version), name: r.name, appliedAt: new Date(r.applied_at) }))
}

/**
 * Splits a script into statements on ";", dropping "--" comments, but keeps $$-quoted bodies
 * (trigger functions) intact.
 */
export function splitSql(sql: string): string[] {
  const out: string[] = []
  let cur = ''
  let inDollar = false
  for (const raw of sql.split('\n')) {
    let line = raw
    if (!inDollar) {
      if (line.trim().startsWith('--')) continue
      // Strip trailing "-- comment" (migrations have no string literals containing "--").
      line = line.replace(/\s--.*$/, '')
    }
    for (let i = 0; i < line.length; i++) {
      if (line.startsWith('$$', i)) {
        inDollar = !inDollar
        cur += '$$'
        i++
      } else if (line[i] === ';' && !inDollar) {
        if (cur.trim()) out.push(cur.trim())
        cur = ''
      } else cur += line[i]
    }
    cur += '\n'
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
