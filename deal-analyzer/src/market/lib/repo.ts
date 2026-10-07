/**
 * VF-03 data access. No scoring logic here (that lives in src/market/engine).
 * Every change writes a market_audit row in the same transaction. Observations are append-only.
 */
import { createHash } from 'node:crypto'
import type { DealInputs } from '@/engine/types'
import type { Db } from '@/lib/db'
import type { Avatar } from '../engine/avatar'
import type { ConfigOverrides } from '../engine/config'
import type { MarketEvaluation } from '../engine/evaluate'
import type { Candidate } from '../engine/handoff'
import {
  PARENT_LEVELS,
  type ConfidenceLevel,
  type Geography,
  type GeoLevel,
  type HardFlagSeverity,
  type HardRiskFlag,
  type Observation,
} from '../engine/types'

type Row = Record<string, unknown>
const json = (v: unknown) => JSON.stringify(v ?? null)
const parse = <T,>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const date = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export async function audit(db: Db, entity: string, entityId: string, action: string, oldV: unknown, newV: unknown, by: string) {
  await db.query(
    `insert into market_audit (entity, entity_id, action, old_value, new_value, changed_by) values ($1,$2,$3,$4::text::jsonb,$5::text::jsonb,$6)`,
    [entity, entityId, action, json(oldV), json(newV), by],
  )
}

export interface AuditRow {
  entity: string
  entityId: string
  action: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt: Date
}

export async function auditFor(db: Db, entity: string, entityId: string, limit = 50): Promise<AuditRow[]> {
  const rows = await db.query<Row>(
    'select * from market_audit where entity = $1 and entity_id = $2 order by changed_at desc, id desc limit $3',
    [entity, entityId, limit],
  )
  return rows.map((r) => ({
    entity: r.entity as string,
    entityId: r.entity_id as string,
    action: r.action as string,
    oldValue: r.old_value,
    newValue: r.new_value,
    changedBy: r.changed_by as string,
    changedAt: new Date(r.changed_at as string),
  }))
}

// ---------------------------------------------------------------- geographies

const toGeo = (r: Row): Geography & { createdAt: Date } => ({
  id: r.id as string,
  level: r.level as GeoLevel,
  code: (r.code as string) ?? null,
  name: r.name as string,
  parentId: (r.parent_id as string) ?? null,
  state: (r.state as string) ?? null,
  createdAt: new Date(r.created_at as string),
})

const ID_PREFIX: Record<GeoLevel, string> = {
  country: 'country',
  msa: 'cbsa',
  submarket: 'submarket',
  zcta: 'zcta',
  tract: 'tract',
  block_group: 'bg',
  micro: 'micro',
}

/** Official code for the level, or null for user-defined areas (submarket, micro cluster). */
export function geoIdFor(level: GeoLevel, code: string | null, uuid: () => string): string {
  if (level === 'submarket' || level === 'micro') return `${ID_PREFIX[level]}:${uuid()}`
  return `${ID_PREFIX[level]}:${code}`
}

export const CODE_RULES: Partial<Record<GeoLevel, RegExp>> = {
  country: /^US$/,
  msa: /^\d{5}$/,
  zcta: /^\d{5}$/,
  tract: /^\d{11}$/,
  block_group: /^\d{12}$/,
}

export function geoRepo(db: Db) {
  return {
    async list(filter: { level?: GeoLevel; parentId?: string | null } = {}) {
      const where: string[] = []
      const params: unknown[] = []
      if (filter.level) where.push(`level = $${params.push(filter.level)}`)
      if (filter.parentId !== undefined) where.push(filter.parentId === null ? 'parent_id is null' : `parent_id = $${params.push(filter.parentId)}`)
      const rows = await db.query<Row>(`select * from geographies ${where.length ? 'where ' + where.join(' and ') : ''} order by name`, params)
      return rows.map(toGeo)
    },
    async get(id: string) {
      const [r] = await db.query<Row>('select * from geographies where id = $1', [id])
      return r ? toGeo(r) : null
    },
    async ancestors(id: string) {
      const out: Geography[] = []
      let cur = await this.get(id)
      while (cur?.parentId) {
        cur = await this.get(cur.parentId)
        if (cur) out.unshift(cur)
      }
      return out
    },
    /** Validates the hierarchy (allowed parent level) before inserting. */
    async create(g: { level: GeoLevel; code: string | null; name: string; parentId: string | null; state: string | null }, by: string): Promise<string> {
      const rule = CODE_RULES[g.level]
      if (rule && !(g.code && rule.test(g.code))) throw new Error(`A ${g.level} needs its official code`)
      if (!g.name.trim()) throw new Error('Name is required')
      const allowed = PARENT_LEVELS[g.level]
      let parent: Geography | null = null
      if (g.parentId) {
        parent = await this.get(g.parentId)
        if (!parent) throw new Error('Parent not found')
        if (!allowed.includes(parent.level)) throw new Error(`A ${g.level} cannot sit under a ${parent.level}`)
      } else if (allowed.length && g.level !== 'msa') throw new Error(`A ${g.level} needs a parent (${allowed.join(' or ')})`)
      const id = geoIdFor(g.level, g.code, () => crypto.randomUUID())
      return db.transaction(async (tx) => {
        await tx.query(
          `insert into geographies (id, level, code, name, parent_id, state, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
          [id, g.level, g.code, g.name.trim(), g.parentId, g.state ?? parent?.state ?? null, by],
        )
        await audit(tx, 'geography', id, 'created', null, g, by)
        return id
      })
    },
  }
}

// ---------------------------------------------------------------- observations & ingestion

export function fingerprint(o: Observation): string {
  return createHash('sha256')
    .update(json([o.geoId, o.metric, o.source, o.asOf, o.value, o.moe ?? null, o.detail ?? null, o.confidence, o.unit]))
    .digest('hex')
}

const toObs = (r: Row): Observation & { validationStatus: string; validationErrors: string[]; enteredBy: string; runId: string | null } => ({
  id: r.id as string,
  geoId: r.geo_id as string,
  metric: r.metric as string,
  // Rejected rows may have no value (never shown or used as 0).
  value: r.value === null ? Number.NaN : Number(r.value),
  unit: r.unit as string,
  moe: num(r.moe),
  detail: parse(r.detail) ?? null,
  source: r.source as string,
  sourceUrl: (r.source_url as string) ?? null,
  asOf: r.as_of === null ? '' : date(r.as_of),
  retrievedAt: iso(r.retrieved_at),
  confidence: r.confidence as ConfidenceLevel,
  methodology: r.methodology as string,
  validationStatus: r.validation_status as string,
  validationErrors: parse<string[]>(r.validation_errors) ?? [],
  enteredBy: r.entered_by as string,
  runId: (r.run_id as string) ?? null,
})

export function observationsRepo(db: Db) {
  return {
    /** Append-only insert. An identical observation already on file is a duplicate (not re-inserted). */
    async insert(
      o: Observation,
      v: { errors: string[]; methodologyVersion: string; runId: string | null; enteredBy: string; raw?: unknown },
    ): Promise<'accepted' | 'rejected' | 'duplicate'> {
      const status = v.errors.length ? 'rejected' : 'accepted'
      const rows = await db.query<{ id: string }>(
        `insert into market_observations (geo_id, metric, value, unit, moe, detail, source, source_url, as_of, retrieved_at, confidence,
           methodology, methodology_version, validation_status, validation_errors, raw, run_id, entered_by, fingerprint)
         values ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9::date,$10::timestamptz,$11,$12,$13,$14,$15::text::jsonb,$16::text::jsonb,$17,$18,$19)
         on conflict (fingerprint) do nothing returning id`,
        [
          o.geoId,
          o.metric,
          Number.isFinite(o.value) ? o.value : null,
          o.unit,
          o.moe ?? null,
          json(o.detail),
          o.source,
          o.sourceUrl,
          /^\d{4}-\d{2}-\d{2}$/.test(o.asOf) && !Number.isNaN(Date.parse(o.asOf)) ? o.asOf : null,
          o.retrievedAt,
          o.confidence,
          o.methodology,
          v.methodologyVersion,
          status,
          json(v.errors),
          json(v.raw),
          v.runId,
          v.enteredBy,
          fingerprint(o),
        ],
      )
      return rows.length ? status : 'duplicate'
    },
    async accepted(geoIds: string[]): Promise<Observation[]> {
      if (!geoIds.length) return []
      const rows = await db.query<Row>(
        `select * from market_observations where validation_status = 'accepted' and geo_id = any($1::text[]) order by as_of, retrieved_at`,
        [geoIds],
      )
      return rows.map(toObs)
    },
    async forGeo(geoId: string, opts: { includeRejected?: boolean } = {}) {
      const rows = await db.query<Row>(
        `select * from market_observations where geo_id = $1 ${opts.includeRejected ? '' : "and validation_status = 'accepted'"} order by metric, as_of desc, retrieved_at desc`,
        [geoId],
      )
      return rows.map(toObs)
    },
  }
}

export interface RunRow {
  id: string
  provider: string
  geoId: string | null
  status: string
  requestedBy: string
  accepted: number
  rejected: number
  duplicates: number
  errors: string[]
  startedAt: Date
  finishedAt: Date | null
}

const toRun = (r: Row): RunRow => ({
  id: r.id as string,
  provider: r.provider as string,
  geoId: (r.geo_id as string) ?? null,
  status: r.status as string,
  requestedBy: r.requested_by as string,
  accepted: Number(r.accepted),
  rejected: Number(r.rejected),
  duplicates: Number(r.duplicates),
  errors: parse<string[]>(r.errors) ?? [],
  startedAt: new Date(r.started_at as string),
  finishedAt: r.finished_at ? new Date(r.finished_at as string) : null,
})

export function runsRepo(db: Db) {
  return {
    async start(provider: string, geoId: string | null, by: string, request: unknown, methodologyVersion: string): Promise<string> {
      const [r] = await db.query<{ id: string }>(
        `insert into ingestion_runs (provider, geo_id, requested_by, request, methodology_version) values ($1,$2,$3,$4::text::jsonb,$5) returning id`,
        [provider, geoId, by, json(request), methodologyVersion],
      )
      return r.id
    },
    async raw(runId: string, payloads: unknown[]) {
      for (let i = 0; i < payloads.length; i++)
        await db.query('insert into ingestion_raw (run_id, seq, payload) values ($1,$2,$3::text::jsonb)', [runId, i, json(payloads[i])])
    },
    async finish(runId: string, r: { status: string; accepted: number; rejected: number; duplicates: number; errors: string[] }) {
      await db.query(
        `update ingestion_runs set status=$2, accepted=$3, rejected=$4, duplicates=$5, errors=$6::text::jsonb, finished_at=now() where id=$1`,
        [runId, r.status, r.accepted, r.rejected, r.duplicates, json(r.errors)],
      )
    },
    async list(filter: { geoId?: string; limit?: number } = {}): Promise<RunRow[]> {
      const rows = filter.geoId
        ? await db.query<Row>('select * from ingestion_runs where geo_id = $1 order by started_at desc limit $2', [filter.geoId, filter.limit ?? 20])
        : await db.query<Row>('select * from ingestion_runs order by started_at desc limit $1', [filter.limit ?? 50])
      return rows.map(toRun)
    },
  }
}

// ---------------------------------------------------------------- flags, samples, config

export function flagsRepo(db: Db) {
  return {
    async active(geoIds: string[]): Promise<HardRiskFlag[]> {
      if (!geoIds.length) return []
      const rows = await db.query<Row>('select * from market_hard_flags where active and geo_id = any($1::text[]) order by created_at', [geoIds])
      return rows.map((r) => ({
        id: r.id as string,
        geoId: r.geo_id as string,
        severity: r.severity as HardFlagSeverity,
        category: r.category as string,
        reason: r.reason as string,
        source: r.source as string,
        sourceUrl: (r.source_url as string) ?? null,
      }))
    },
    async add(f: Omit<HardRiskFlag, 'id'>, by: string): Promise<string> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into market_hard_flags (geo_id, severity, category, reason, source, source_url, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [f.geoId, f.severity, f.category, f.reason, f.source, f.sourceUrl, by],
        )
        await audit(tx, 'hard_flag', r.id, 'added', null, f, by)
        return r.id
      })
    },
    async resolve(id: string, by: string): Promise<void> {
      if (!isUuid(id)) return
      await db.transaction(async (tx) => {
        await tx.query('update market_hard_flags set active = false, resolved_by = $2, resolved_at = now() where id = $1 and active', [id, by])
        await audit(tx, 'hard_flag', id, 'resolved', null, null, by)
      })
    },
  }
}

export interface SampleRow {
  id: string
  geoId: string
  label: string
  kind: 'assumption' | 'deal'
  dealId: string | null
  inputs: Partial<DealInputs> | null
  source: string
  sourceUrl: string | null
  confidence: ConfidenceLevel
  asOf: string
  createdBy: string
}

export function samplesRepo(db: Db) {
  return {
    async active(geoIds: string[]): Promise<SampleRow[]> {
      if (!geoIds.length) return []
      const rows = await db.query<Row>('select * from market_deal_samples where active and geo_id = any($1::text[]) order by created_at', [geoIds])
      return rows.map((r) => ({
        id: r.id as string,
        geoId: r.geo_id as string,
        label: r.label as string,
        kind: r.kind as 'assumption' | 'deal',
        dealId: (r.deal_id as string) ?? null,
        inputs: parse<Partial<DealInputs> | null>(r.inputs),
        source: r.source as string,
        sourceUrl: (r.source_url as string) ?? null,
        confidence: r.confidence as ConfidenceLevel,
        asOf: date(r.as_of),
        createdBy: r.created_by as string,
      }))
    },
    async add(s: Omit<SampleRow, 'id' | 'createdBy'>, by: string): Promise<string> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into market_deal_samples (geo_id, label, kind, deal_id, inputs, source, source_url, confidence, as_of, created_by)
           values ($1,$2,$3,$4,$5::text::jsonb,$6,$7,$8,$9::date,$10) returning id`,
          [s.geoId, s.label, s.kind, s.dealId, s.inputs ? json(s.inputs) : null, s.source, s.sourceUrl, s.confidence, s.asOf, by],
        )
        await audit(tx, 'deal_sample', r.id, 'added', null, s, by)
        return r.id
      })
    },
    async retire(id: string, by: string) {
      if (!isUuid(id)) return
      await db.transaction(async (tx) => {
        await tx.query('update market_deal_samples set active = false where id = $1', [id])
        await audit(tx, 'deal_sample', id, 'retired', null, null, by)
      })
    },
  }
}

export function configRepo(db: Db) {
  return {
    async overrides(): Promise<ConfigOverrides> {
      const [r] = await db.query<Row>("select value from market_config where key = 'overrides'")
      return r ? parse<ConfigOverrides>(r.value) ?? {} : {}
    },
    async save(next: ConfigOverrides, by: string): Promise<number> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<Row>("select value from market_config where key = 'overrides' for update")
        const cur = r ? parse<ConfigOverrides>(r.value) ?? {} : {}
        const keys = [...new Set([...Object.keys(cur), ...Object.keys(next)])].filter((k) => cur[k] !== next[k])
        if (!keys.length) return 0
        await tx.query(
          `insert into market_config (key, value, updated_by) values ('overrides', $1::text::jsonb, $2)
           on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
          [json(next), by],
        )
        for (const k of keys) await audit(tx, 'config', k, 'changed', cur[k] ?? null, next[k] ?? null, by)
        return keys.length
      })
    },
    async history(limit = 50): Promise<AuditRow[]> {
      const rows = await db.query<Row>("select * from market_audit where entity = 'config' order by changed_at desc, id desc limit $1", [limit])
      return rows.map((r) => ({
        entity: 'config',
        entityId: r.entity_id as string,
        action: r.action as string,
        oldValue: r.old_value,
        newValue: r.new_value,
        changedBy: r.changed_by as string,
        changedAt: new Date(r.changed_at as string),
      }))
    },
  }
}

// ---------------------------------------------------------------- snapshots & promotions

export interface SnapshotRow {
  id: number
  batchId: string
  geoId: string
  evaluationDate: string
  engineVersion: string
  priority: number | null
  decision: string
  result: MarketEvaluation
  createdBy: string
  createdAt: Date
}

const toSnap = (r: Row): SnapshotRow => ({
  id: Number(r.id),
  batchId: r.batch_id as string,
  geoId: r.geo_id as string,
  evaluationDate: date(r.evaluation_date),
  engineVersion: r.engine_version as string,
  priority: num(r.priority),
  decision: r.decision as string,
  result: parse<MarketEvaluation>(r.result),
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string),
})

export function snapshotsRepo(db: Db) {
  return {
    async insertBatch(evals: MarketEvaluation[], config: unknown, by: string): Promise<string> {
      const batch = crypto.randomUUID()
      await db.transaction(async (tx) => {
        for (const e of evals)
          await tx.query(
            `insert into market_snapshots (batch_id, geo_id, peer_group, evaluation_date, engine_version, config, priority, decision, result, created_by)
             values ($1,$2,$3,$4::date,$5,$6::text::jsonb,$7,$8,$9::text::jsonb,$10)`,
            [batch, e.geoId, e.peerGroup.key, e.evaluationDate, e.engineVersion, json(config), e.priority.point, e.decision.state, json(e), by],
          )
      })
      return batch
    },
    /** The latest and the previous snapshot of each geography. */
    async latestTwo(): Promise<Map<string, { latest: SnapshotRow; previous: SnapshotRow | null }>> {
      const rows = await db.query<Row>(
        `select * from (select s.*, row_number() over (partition by geo_id order by created_at desc, id desc) as rn from market_snapshots s) x where rn <= 2`,
      )
      const out = new Map<string, { latest: SnapshotRow; previous: SnapshotRow | null }>()
      for (const r of rows.sort((a, b) => Number(a.rn) - Number(b.rn))) {
        const s = toSnap(r)
        const cur = out.get(s.geoId)
        if (!cur) out.set(s.geoId, { latest: s, previous: null })
        else cur.previous = s
      }
      return out
    },
    async history(geoId: string, limit = 24): Promise<SnapshotRow[]> {
      const rows = await db.query<Row>('select * from market_snapshots where geo_id = $1 order by created_at desc, id desc limit $2', [geoId, limit])
      return rows.map(toSnap)
    },
    async get(id: number): Promise<SnapshotRow | null> {
      const [r] = await db.query<Row>('select * from market_snapshots where id = $1', [id])
      return r ? toSnap(r) : null
    },
  }
}

export interface PromotionRow {
  id: string
  geoId: string
  snapshotId: number | null
  reason: { checks: { label: string; pass: boolean | null; detail: string }[]; decision: string; priority: number | null; note?: string }
  promotedBy: string
  promotedAt: Date
}

export function promotionsRepo(db: Db) {
  return {
    async active(): Promise<Map<string, PromotionRow>> {
      const rows = await db.query<Row>('select * from geo_promotions where revoked_at is null')
      return new Map(
        rows.map((r) => [
          r.geo_id as string,
          {
            id: r.id as string,
            geoId: r.geo_id as string,
            snapshotId: num(r.snapshot_id),
            reason: parse<PromotionRow['reason']>(r.reason),
            promotedBy: r.promoted_by as string,
            promotedAt: new Date(r.promoted_at as string),
          },
        ]),
      )
    },
    async promote(geoId: string, snapshotId: number, reason: PromotionRow['reason'], by: string) {
      await db.transaction(async (tx) => {
        await tx.query('insert into geo_promotions (geo_id, snapshot_id, reason, promoted_by) values ($1,$2,$3::text::jsonb,$4)', [geoId, snapshotId, json(reason), by])
        await audit(tx, 'geography', geoId, 'promoted', null, reason, by)
      })
    },
    async revoke(geoId: string, by: string) {
      await db.transaction(async (tx) => {
        await tx.query('update geo_promotions set revoked_by = $2, revoked_at = now() where geo_id = $1 and revoked_at is null', [geoId, by])
        await audit(tx, 'geography', geoId, 'promotion_revoked', null, null, by)
      })
    },
  }
}

// ---------------------------------------------------------------- avatars, candidates, outcomes

type AvatarCriteria = Omit<Avatar, 'id' | 'name' | 'description' | 'strategies' | 'active'>

const toAvatar = (r: Row): Avatar & { version: number } => ({
  id: r.id as string,
  name: r.name as string,
  description: r.description as string,
  ...parse<AvatarCriteria>(r.criteria),
  strategies: parse<Avatar['strategies']>(r.strategies) ?? [],
  active: Boolean(r.active),
  version: Number(r.version),
})

export class VersionConflictError extends Error {
  constructor(what: string) {
    super(`This ${what} was changed by someone else after you opened it. Reload and re-apply your changes.`)
  }
}

export function avatarsRepo(db: Db) {
  return {
    async list(opts: { activeOnly?: boolean } = {}) {
      const rows = await db.query<Row>(`select * from avatars ${opts.activeOnly ? 'where active' : ''} order by name`)
      return rows.map(toAvatar)
    },
    async get(id: string) {
      if (!isUuid(id)) return null
      const [r] = await db.query<Row>('select * from avatars where id = $1', [id])
      return r ? toAvatar(r) : null
    },
    async save(a: Omit<Avatar, 'id'> & { id?: string; version?: number }, by: string): Promise<string> {
      const { name, description, strategies, active, id, version, ...criteria } = a
      return db.transaction(async (tx) => {
        if (!id) {
          const [r] = await tx.query<{ id: string }>(
            `insert into avatars (name, description, criteria, strategies, active, created_by, updated_by) values ($1,$2,$3::text::jsonb,$4::text::jsonb,$5,$6,$6) returning id`,
            [name, description, json(criteria), json(strategies), active, by],
          )
          await audit(tx, 'avatar', r.id, 'created', null, a, by)
          return r.id
        }
        const [cur] = await tx.query<Row>('select * from avatars where id = $1 for update', [id])
        if (!cur) throw new Error('Avatar not found')
        if (version !== undefined && Number(cur.version) !== version) throw new VersionConflictError('avatar')
        await tx.query(
          `update avatars set name=$2, description=$3, criteria=$4::text::jsonb, strategies=$5::text::jsonb, active=$6, version=version+1, updated_by=$7, updated_at=now() where id=$1`,
          [id, name, description, json(criteria), json(strategies), active, by],
        )
        await audit(tx, 'avatar', id, 'updated', toAvatar(cur), a, by)
        return id
      })
    },
  }
}

export type CandidateRow = Omit<Candidate, 'geoName' | 'avatarName'> & {
  avatarId: string | null
  status: 'new' | 'handed_off' | 'rejected'
  dealId: string | null
  version: number
  createdBy: string
  createdAt: Date
}

const toCandidate = (r: Row): CandidateRow => ({
  id: r.id as string,
  geoId: r.geo_id as string,
  avatarId: (r.avatar_id as string) ?? null,
  address: r.address as string,
  city: (r.city as string) ?? null,
  state: (r.state as string) ?? null,
  zip: (r.zip as string) ?? null,
  propertyType: (r.property_type as Candidate['propertyType']) ?? null,
  beds: num(r.beds),
  baths: num(r.baths),
  sqft: num(r.sqft),
  yearBuilt: num(r.year_built),
  askingPrice: num(r.asking_price),
  condition: (r.condition as string) ?? null,
  estArv: num(r.est_arv),
  estRehab: num(r.est_rehab),
  estRent: num(r.est_rent),
  source: r.source as string,
  sourceUrl: (r.source_url as string) ?? null,
  notes: (r.notes as string) ?? null,
  status: r.status as CandidateRow['status'],
  dealId: (r.deal_id as string) ?? null,
  version: Number(r.version),
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string),
})

export function candidatesRepo(db: Db) {
  return {
    async list(filter: { geoId?: string; status?: string } = {}) {
      const where: string[] = []
      const params: unknown[] = []
      if (filter.geoId) where.push(`geo_id = $${params.push(filter.geoId)}`)
      if (filter.status) where.push(`status = $${params.push(filter.status)}`)
      const rows = await db.query<Row>(`select * from candidates ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc`, params)
      return rows.map(toCandidate)
    },
    async get(id: string) {
      if (!isUuid(id)) return null
      const [r] = await db.query<Row>('select * from candidates where id = $1', [id])
      return r ? toCandidate(r) : null
    },
    async create(c: Omit<CandidateRow, 'id' | 'status' | 'dealId' | 'version' | 'createdBy' | 'createdAt'>, by: string): Promise<string> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into candidates (geo_id, avatar_id, address, city, state, zip, property_type, beds, baths, sqft, year_built, asking_price, condition,
             est_arv, est_rehab, est_rent, source, source_url, notes, created_by, updated_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) returning id`,
          [c.geoId, c.avatarId, c.address, c.city, c.state, c.zip, c.propertyType, c.beds, c.baths, c.sqft, c.yearBuilt, c.askingPrice, c.condition, c.estArv, c.estRehab, c.estRent, c.source, c.sourceUrl, c.notes, by],
        )
        await audit(tx, 'candidate', r.id, 'created', null, c, by)
        return r.id
      })
    },
    /** Status change with optimistic locking. */
    async setStatus(id: string, status: CandidateRow['status'], expectedVersion: number, by: string, dealId: string | null = null) {
      const rows = await db.query<{ id: string }>(
        `update candidates set status=$2, deal_id=coalesce($3, deal_id), version=version+1, updated_by=$4, updated_at=now() where id=$1 and version=$5 returning id`,
        [id, status, dealId, by, expectedVersion],
      )
      if (!rows.length) throw new VersionConflictError('candidate')
      await audit(db, 'candidate', id, `status:${status}`, null, { dealId }, by)
    },
  }
}

export interface OutcomeRow {
  dealId: string
  candidateId: string | null
  geoId: string | null
  avatarId: string | null
  predictedSnapshotId: number | null
  propertyType: string | null
  purchasePrice: number | null
  arv: number | null
  rehab: number | null
  rent: number | null
  timelineMonths: number | null
  exitStrategy: string | null
  actualProfit: number | null
  actualAnnualCashFlow: number | null
  actualRefiLoan: number | null
  actualCapitalRecovered: number | null
  notes: string | null
  version: number
  recordedBy: string
  recordedAt: Date
}

const OUTCOME_COLS: [keyof OutcomeRow, string][] = [
  ['candidateId', 'candidate_id'],
  ['geoId', 'geo_id'],
  ['avatarId', 'avatar_id'],
  ['predictedSnapshotId', 'predicted_snapshot_id'],
  ['propertyType', 'property_type'],
  ['purchasePrice', 'purchase_price'],
  ['arv', 'arv'],
  ['rehab', 'rehab'],
  ['rent', 'rent'],
  ['timelineMonths', 'timeline_months'],
  ['exitStrategy', 'exit_strategy'],
  ['actualProfit', 'actual_profit'],
  ['actualAnnualCashFlow', 'actual_annual_cash_flow'],
  ['actualRefiLoan', 'actual_refi_loan'],
  ['actualCapitalRecovered', 'actual_capital_recovered'],
  ['notes', 'notes'],
]

const toOutcome = (r: Row): OutcomeRow =>
  ({
    dealId: r.deal_id as string,
    ...Object.fromEntries(OUTCOME_COLS.map(([k, c]) => [k, r[c] === null || r[c] === undefined ? null : typeof r[c] === 'number' || /^(purchase|arv|rehab|rent|timeline|actual|predicted)/.test(c) ? num(r[c]) : r[c]])),
    version: Number(r.version),
    recordedBy: r.recorded_by as string,
    recordedAt: new Date(r.recorded_at as string),
  }) as OutcomeRow

export type OutcomeInput = Omit<OutcomeRow, 'dealId' | 'version' | 'recordedBy' | 'recordedAt'>

export function outcomesRepo(db: Db) {
  return {
    async get(dealId: string): Promise<OutcomeRow | null> {
      if (!isUuid(dealId)) return null
      const [r] = await db.query<Row>('select * from deal_outcomes where deal_id = $1', [dealId])
      return r ? toOutcome(r) : null
    },
    async list(filter: { geoId?: string } = {}): Promise<OutcomeRow[]> {
      const rows = filter.geoId
        ? await db.query<Row>('select * from deal_outcomes where geo_id = $1 order by recorded_at desc', [filter.geoId])
        : await db.query<Row>('select * from deal_outcomes order by recorded_at desc')
      return rows.map(toOutcome)
    },
    /** Insert or update (optimistic locking on update); audited on the deal's own trail. */
    async save(dealId: string, o: OutcomeInput, by: string, expectedVersion?: number): Promise<void> {
      await db.transaction(async (tx) => {
        const [cur] = await tx.query<Row>('select * from deal_outcomes where deal_id = $1 for update', [dealId])
        const values = OUTCOME_COLS.map(([k]) => o[k as keyof OutcomeInput] ?? null)
        if (!cur) {
          await tx.query(
            `insert into deal_outcomes (deal_id, ${OUTCOME_COLS.map(([, c]) => c).join(', ')}, recorded_by)
             values ($1, ${OUTCOME_COLS.map((_, i) => `$${i + 2}`).join(', ')}, $${OUTCOME_COLS.length + 2})`,
            [dealId, ...values, by],
          )
        } else {
          if (expectedVersion !== undefined && Number(cur.version) !== expectedVersion) throw new VersionConflictError('result')
          await tx.query(
            `update deal_outcomes set ${OUTCOME_COLS.map(([, c], i) => `${c} = $${i + 2}`).join(', ')}, version = version + 1,
               recorded_by = $${OUTCOME_COLS.length + 2}, recorded_at = now() where deal_id = $1`,
            [dealId, ...values, by],
          )
        }
        await tx.query(
          `insert into deal_audit (deal_id, field, old_value, new_value, changed_by) values ($1,'outcome',$2::text::jsonb,$3::text::jsonb,$4)`,
          [dealId, json(cur ? toOutcome(cur) : null), json(o), by],
        )
      })
    },
  }
}
