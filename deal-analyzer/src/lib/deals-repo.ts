/** Data access for deals + audit trail. No business logic lives here. */
import { emptyInputs, isDefaultable, type DefaultableKey } from '@/engine/fields'
import type { DealInputs, DealStatus } from '@/engine/types'
import { diffDeal } from './audit'
import type { Db } from './db'
import type { DealNotes } from './notes'
import type { User } from './users'

export interface DealRecord {
  id: string
  status: DealStatus
  inputs: DealInputs
  notes: DealNotes
  /** Inputs filled from ValeForge defaults and not yet confirmed for this deal. */
  defaulted: DefaultableKey[]
  /** Optimistic-lock version: bumped on every change to inputs, notes or status. */
  version: number
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface AuditEntry {
  id: number
  field: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt: Date
}

export interface DealQuery {
  market?: string
  zip?: string
  status?: string
  createdFrom?: string // YYYY-MM-DD
  createdTo?: string
}

type Row = Record<string, unknown>

/** Someone saved the deal after this form was opened (optimistic locking, VF-03 §22). */
export class DealConflictError extends Error {
  constructor(
    public readonly updatedBy: string,
    public readonly updatedAt: Date,
  ) {
    super(`This deal was changed by ${updatedBy} after you opened it.`)
    this.name = 'DealConflictError'
  }
}

function toRecord(r: Row): DealRecord {
  const parse = <T,>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T
  return {
    id: r.id as string,
    status: r.status as DealStatus,
    // Merge onto defaults so fields added after a deal was saved read as UNKNOWN.
    inputs: { ...emptyInputs(), ...parse<Partial<DealInputs>>(r.inputs) },
    notes: parse<DealNotes>(r.notes) ?? {},
    defaulted: (parse<string[]>(r.defaulted) ?? []).filter(isDefaultable),
    version: Number(r.version ?? 1),
    createdBy: r.created_by as string,
    updatedBy: r.updated_by as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

// JSON params are bound as text and cast server-side: binding a JS string straight to a
// jsonb parameter makes postgres.js store a JSON *string* instead of an object.
const identity = (i: DealInputs) => [i.address ?? '', i.city, i.state, i.zip, i.market]

export function dealsRepo(db: Db) {
  return {
    async list(q: DealQuery = {}): Promise<DealRecord[]> {
      const where: string[] = []
      const params: unknown[] = []
      const add = (sql: string, v: unknown) => {
        params.push(v)
        where.push(sql.replace('?', `$${params.length}`))
      }
      if (q.market) add('market = ?', q.market)
      if (q.zip) add('zip = ?', q.zip)
      if (q.status) add('status = ?', q.status)
      if (q.createdFrom) add('created_at >= ?::date', q.createdFrom)
      if (q.createdTo) add("created_at < (?::date + interval '1 day')", q.createdTo)
      const rows = await db.query<Row>(
        `select * from deals ${where.length ? 'where ' + where.join(' and ') : ''} order by updated_at desc`,
        params,
      )
      return rows.map(toRecord)
    },

    async get(id: string): Promise<DealRecord | null> {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const rows = await db.query<Row>('select * from deals where id = $1', [id])
      return rows[0] ? toRecord(rows[0]) : null
    },

    async create(
      inputs: DealInputs,
      notes: DealNotes,
      status: DealStatus,
      user: User,
      defaulted: DefaultableKey[] = [],
    ): Promise<string> {
      return db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          `insert into deals (address, city, state, zip, market, status, inputs, notes, defaulted, created_by, updated_by)
           values ($1,$2,$3,$4,$5,$6,$7::text::jsonb,$8::text::jsonb,$9::text::jsonb,$10,$10) returning id`,
          [...identity(inputs), status, JSON.stringify(inputs), JSON.stringify(notes), JSON.stringify(defaulted), user],
        )
        const id = rows[0].id
        await tx.query(
          `insert into deal_audit (deal_id, field, old_value, new_value, changed_by) values ($1,'created',null,null,$2)`,
          [id, user],
        )
        return id
      })
    },

    /**
     * Saves and writes one audit row per changed field, in one transaction. With
     * `expectedVersion`, refuses (DealConflictError) if anyone saved the deal since that version.
     * Returns the number of changed fields.
     */
    async update(
      id: string,
      next: { inputs?: DealInputs; notes?: DealNotes; status?: DealStatus },
      user: User,
      opts: { expectedVersion?: number } = {},
    ): Promise<number> {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Deal not found')
      return db.transaction(async (tx) => {
        const [row] = await tx.query<Row>('select * from deals where id = $1 for update', [id])
        if (!row) throw new Error('Deal not found')
        const current = toRecord(row)
        if (opts.expectedVersion !== undefined && opts.expectedVersion !== current.version)
          throw new DealConflictError(current.updatedBy, current.updatedAt)
        const after = {
          inputs: next.inputs ?? current.inputs,
          notes: next.notes ?? current.notes,
          status: next.status ?? current.status,
        }
        const changes = diffDeal(current, after)
        if (changes.length === 0) return 0
        await tx.query(
          `update deals set address=$2, city=$3, state=$4, zip=$5, market=$6, status=$7, inputs=$8::text::jsonb, notes=$9::text::jsonb,
             updated_by=$10, updated_at=now(), version=version+1 where id=$1`,
          [id, ...identity(after.inputs), after.status, JSON.stringify(after.inputs), JSON.stringify(after.notes), user],
        )
        for (const c of changes) {
          await tx.query(
            `insert into deal_audit (deal_id, field, old_value, new_value, changed_by) values ($1,$2,$3::text::jsonb,$4::text::jsonb,$5)`,
            [id, c.field, JSON.stringify(c.oldValue ?? null), JSON.stringify(c.newValue ?? null), user],
          )
        }
        return changes.length
      })
    },

    /** Which inputs are still unconfirmed defaults (a marker only, not audited). */
    async setDefaulted(id: string, keys: DefaultableKey[]): Promise<void> {
      await db.query('update deals set defaulted = $2::text::jsonb where id = $1', [id, JSON.stringify(keys)])
    },

    async audit(id: string): Promise<AuditEntry[]> {
      const rows = await db.query<Row>(
        'select * from deal_audit where deal_id = $1 order by changed_at desc, id desc',
        [id],
      )
      // Drivers decode jsonb, so a JSON string value arrives as a JS string.
      return rows.map((r) => ({
        id: Number(r.id),
        field: r.field as string,
        oldValue: r.old_value,
        newValue: r.new_value,
        changedBy: r.changed_by as string,
        changedAt: new Date(r.changed_at as string),
      }))
    },

    async distinct(column: 'market' | 'zip'): Promise<string[]> {
      const rows = await db.query<{ v: string }>(
        `select distinct ${column} as v from deals where ${column} is not null and ${column} <> '' order by 1`,
      )
      return rows.map((r) => r.v)
    },
  }
}
