import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { loadMigrations, runMigrations } from './migrations'

/**
 * Minimal query interface so the repositories are driver-agnostic.
 *  - DATABASE_URL set   → PostgreSQL via postgres.js
 *  - DATABASE_URL unset → embedded PGlite (real Postgres in WASM) at PGLITE_DIR or ./.data/pglite
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** Runs a multi-statement script (no parameters). */
  exec(script: string): Promise<void>
  /**
   * Runs `fn` in one transaction: everything commits or nothing does. Inside, use only the
   * `tx` handle (PGlite has a single connection, so the outer handle would wait forever).
   * Nested calls on `tx` join the same transaction.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
}

type Exec = Pick<Db, 'query' | 'exec'>

/** A handle bound to an open transaction: nested transaction() calls simply join it. */
function inTx(h: Exec): Db {
  const tx: Db = { ...h, transaction: (fn) => fn(tx) }
  return tx
}

async function createDb(): Promise<Db> {
  let db: Db
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import('postgres')
    const sql = postgres(process.env.DATABASE_URL, { max: 5, prepare: false, onnotice: () => {} })
    type Sql = Pick<typeof sql, 'unsafe'>
    const handle = (s: Sql): Exec => ({
      query: async <T,>(q: string, params: unknown[] = []) => (await s.unsafe(q, params as never[])) as unknown as T[],
      exec: async (script: string) => {
        await s.unsafe(script)
      },
    })
    db = {
      ...handle(sql),
      transaction: <T,>(fn: (tx: Db) => Promise<T>) => sql.begin((tx) => fn(inTx(handle(tx)))) as Promise<T>,
    }
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite')
    if (dir !== 'memory://') await mkdir(dir, { recursive: true })
    const pg = dir === 'memory://' ? new PGlite() : new PGlite(dir)
    type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0]
    const handle = (s: typeof pg | Tx): Exec => ({
      query: async <T,>(q: string, params: unknown[] = []) => (await s.query<T>(q, params)).rows,
      exec: async (script: string) => {
        await s.exec(script)
      },
    })
    db = {
      ...handle(pg),
      transaction: <T,>(fn: (tx: Db) => Promise<T>) => pg.transaction((tx) => fn(inTx(handle(tx)))),
    }
  }
  await runMigrations(db, await loadMigrations())
  return db
}

export { splitSql } from './migrations'

const g = globalThis as unknown as { __vfDb?: Promise<Db> }

export function getDb(): Promise<Db> {
  g.__vfDb ??= createDb().catch((e) => {
    g.__vfDb = undefined
    throw e
  })
  return g.__vfDb
}
