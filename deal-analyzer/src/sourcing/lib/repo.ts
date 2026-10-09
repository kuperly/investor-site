/** Deal Sourcing data access (layers 3–4): targets and leads. Every change is audited. */
import type { Db } from '@/lib/db'
import { audit, isUuid, VersionConflictError } from '@/market/lib/repo'
import type { Candidate } from '../engine/handoff'
import type { BuyBoxScreen } from '../engine/screen'

type Row = Record<string, unknown>
const json = (v: unknown) => JSON.stringify(v ?? null)
const parse = <T,>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// ---------------------------------------------------------------- targets (layer 3)

export type TargetStatus = 'active' | 'paused' | 'closed'

export interface TargetRow {
  id: string
  geoId: string
  avatarId: string | null
  status: TargetStatus
  gateDecision: string | null
  overrideReason: string | null
  notes: string | null
  version: number
  createdBy: string
  createdAt: Date
}

const toTarget = (r: Row): TargetRow => ({
  id: r.id as string,
  geoId: r.geo_id as string,
  avatarId: (r.avatar_id as string) ?? null,
  status: r.status as TargetStatus,
  gateDecision: (r.gate_decision as string) ?? null,
  overrideReason: (r.override_reason as string) ?? null,
  notes: (r.notes as string) ?? null,
  version: Number(r.version),
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string),
})

export function targetsRepo(db: Db) {
  return {
    async list(filter: { geoId?: string; status?: TargetStatus } = {}): Promise<TargetRow[]> {
      const where: string[] = []
      const params: unknown[] = []
      if (filter.geoId) where.push(`geo_id = $${params.push(filter.geoId)}`)
      if (filter.status) where.push(`status = $${params.push(filter.status)}`)
      const rows = await db.query<Row>(`select * from sourcing_targets ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc`, params)
      return rows.map(toTarget)
    },
    async get(id: string): Promise<TargetRow | null> {
      if (!isUuid(id)) return null
      const [r] = await db.query<Row>('select * from sourcing_targets where id = $1', [id])
      return r ? toTarget(r) : null
    },
    async create(t: { geoId: string; avatarId: string | null; gateDecision: string; overrideReason: string | null; notes: string | null }, by: string): Promise<string> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into sourcing_targets (geo_id, avatar_id, gate_decision, override_reason, notes, created_by, updated_by)
           values ($1,$2,$3,$4,$5,$6,$6) returning id`,
          [t.geoId, t.avatarId, t.gateDecision, t.overrideReason, t.notes, by],
        )
        await audit(tx, 'target', r.id, 'opened', null, t, by)
        return r.id
      })
    },
    async setStatus(id: string, status: TargetStatus, expectedVersion: number, by: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          `update sourcing_targets set status=$2, version=version+1, updated_by=$3, updated_at=now() where id=$1 and version=$4 returning id`,
          [id, status, by, expectedVersion],
        )
        if (!rows.length) throw new VersionConflictError('target')
        await audit(tx, 'target', id, `status:${status}`, null, null, by)
      })
    },
  }
}

// ---------------------------------------------------------------- leads / candidates (layer 4)

export type CandidateRow = Omit<Candidate, 'geoName' | 'avatarName'> & {
  avatarId: string | null
  targetId: string | null
  status: 'new' | 'handed_off' | 'rejected'
  dealId: string | null
  screening: BuyBoxScreen | null
  screenedAt: Date | null
  overrideReason: string | null
  version: number
  createdBy: string
  createdAt: Date
}

export type NewCandidate = Omit<CandidateRow, 'id' | 'status' | 'dealId' | 'screening' | 'screenedAt' | 'overrideReason' | 'version' | 'createdBy' | 'createdAt'> & {
  addressKey: string
}

const toCandidate = (r: Row): CandidateRow => ({
  id: r.id as string,
  geoId: r.geo_id as string,
  avatarId: (r.avatar_id as string) ?? null,
  targetId: (r.target_id as string) ?? null,
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
  screening: parse<BuyBoxScreen | null>(r.screening) ?? null,
  screenedAt: r.screened_at ? new Date(r.screened_at as string) : null,
  overrideReason: (r.override_reason as string) ?? null,
  version: Number(r.version),
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string),
})

export function candidatesRepo(db: Db) {
  return {
    async list(filter: { geoId?: string; status?: string; targetId?: string } = {}): Promise<CandidateRow[]> {
      const where: string[] = []
      const params: unknown[] = []
      if (filter.geoId) where.push(`geo_id = $${params.push(filter.geoId)}`)
      if (filter.status) where.push(`status = $${params.push(filter.status)}`)
      if (filter.targetId) where.push(`target_id = $${params.push(filter.targetId)}`)
      const rows = await db.query<Row>(`select * from candidates ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc`, params)
      return rows.map(toCandidate)
    },
    async get(id: string): Promise<CandidateRow | null> {
      if (!isUuid(id)) return null
      const [r] = await db.query<Row>('select * from candidates where id = $1', [id])
      return r ? toCandidate(r) : null
    },
    /** An open (not rejected) lead with the same normalized address, if any. */
    async findOpenByKey(key: string): Promise<CandidateRow | null> {
      const [r] = await db.query<Row>(`select * from candidates where address_key = $1 and status <> 'rejected' limit 1`, [key])
      return r ? toCandidate(r) : null
    },
    async create(c: NewCandidate, screening: BuyBoxScreen | null, by: string): Promise<string> {
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into candidates (geo_id, avatar_id, target_id, address, address_key, city, state, zip, property_type, beds, baths, sqft, year_built,
             asking_price, condition, est_arv, est_rehab, est_rent, source, source_url, notes, screening, screened_at, created_by, updated_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::text::jsonb,
             case when $22::text = 'null' then null else now() end,$23,$23) returning id`,
          [
            c.geoId, c.avatarId, c.targetId, c.address, c.addressKey, c.city, c.state, c.zip, c.propertyType, c.beds, c.baths, c.sqft, c.yearBuilt,
            c.askingPrice, c.condition, c.estArv, c.estRehab, c.estRent, c.source, c.sourceUrl, c.notes, json(screening), by,
          ],
        )
        await audit(tx, 'candidate', r.id, 'created', null, { ...c, screen: screening?.overall ?? null }, by)
        return r.id
      })
    },
    async setScreening(id: string, screening: BuyBoxScreen | null, by: string): Promise<void> {
      await db.query(`update candidates set screening = $2::text::jsonb, screened_at = now(), version = version + 1, updated_by = $3, updated_at = now() where id = $1`, [
        id,
        json(screening),
        by,
      ])
      await audit(db, 'candidate', id, 'screened', null, { screen: screening?.overall ?? null }, by)
    },
    /** Status change with optimistic locking. */
    async setStatus(id: string, status: CandidateRow['status'], expectedVersion: number, by: string, extra: { dealId?: string | null; overrideReason?: string | null } = {}) {
      const rows = await db.query<{ id: string }>(
        `update candidates set status=$2, deal_id=coalesce($3, deal_id), override_reason=coalesce($6, override_reason), version=version+1, updated_by=$4, updated_at=now()
         where id=$1 and version=$5 returning id`,
        [id, status, extra.dealId ?? null, by, expectedVersion, extra.overrideReason ?? null],
      )
      if (!rows.length) throw new VersionConflictError('lead')
      await audit(db, 'candidate', id, `status:${status}`, null, extra, by)
    },
  }
}
