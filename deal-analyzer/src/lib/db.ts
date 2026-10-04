import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Minimal query interface so the repository is driver-agnostic.
 *  - DATABASE_URL set   → PostgreSQL (e.g. Supabase) via postgres.js
 *  - DATABASE_URL unset → embedded PGlite (real Postgres in WASM) at PGLITE_DIR or ./.data/pglite
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

async function createDb(): Promise<Db> {
  let db: Db
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import('postgres')
    const sql = postgres(process.env.DATABASE_URL, { max: 5, prepare: false })
    db = {
      query: async <T,>(q: string, params: unknown[] = []) =>
        (await sql.unsafe(q, params as never[])) as unknown as T[],
    }
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite')
    if (dir !== 'memory://') await mkdir(dir, { recursive: true })
    const pg = dir === 'memory://' ? new PGlite() : new PGlite(dir)
    db = { query: async <T,>(q: string, params: unknown[] = []) => (await pg.query<T>(q, params)).rows }
  }
  const schema = await readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
  for (const stmt of splitSql(schema)) await db.query(stmt)
  return db
}

export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
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
