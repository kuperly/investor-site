import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Minimal query interface so the repository is driver-agnostic.
 *  - DATABASE_URL set   → PostgreSQL (e.g. Supabase) via postgres.js
 *  - DATABASE_URL unset → embedded PGlite (real Postgres in WASM) at PGLITE_DIR or ./.data/pglite
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /**
   * Applies a multi-statement DDL script in one transaction behind an advisory lock:
   * concurrent cold starts (or parallel test workers) would otherwise race on CREATE … IF NOT EXISTS.
   */
  migrate(script: string): Promise<void>
}

/** Arbitrary constant for the schema-migration advisory lock. */
const SCHEMA_LOCK_ID = 727_274_001

async function createDb(): Promise<Db> {
  let db: Db
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import('postgres')
    const sql = postgres(process.env.DATABASE_URL, { max: 5, prepare: false, onnotice: () => {} })
    db = {
      query: async <T,>(q: string, params: unknown[] = []) =>
        (await sql.unsafe(q, params as never[])) as unknown as T[],
      migrate: async (script: string) => {
        await sql.begin(async (tx) => {
          await tx.unsafe(`select pg_advisory_xact_lock(${SCHEMA_LOCK_ID})`)
          await tx.unsafe(script)
        })
      },
    }
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite')
    if (dir !== 'memory://') await mkdir(dir, { recursive: true })
    const pg = dir === 'memory://' ? new PGlite() : new PGlite(dir)
    db = {
      query: async <T,>(q: string, params: unknown[] = []) => (await pg.query<T>(q, params)).rows,
      migrate: async (script: string) => {
        await pg.transaction(async (tx) => {
          await tx.exec(script)
        })
      },
    }
  }
  const schema = await readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
  await db.migrate(splitSql(schema).join(';\n') + ';')
  return db
}

export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    // Strip trailing "-- comment" (the schema has no string literals containing "--").
    .map((l) => l.replace(/\s--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

const g = globalThis as unknown as { __vfDb?: Promise<Db> }

export function getDb(): Promise<Db> {
  g.__vfDb ??= createDb().catch((e) => {
    g.__vfDb = undefined
    throw e
  })
  return g.__vfDb
}
