/** Data access for §32 comps. Every change bumps the deal and writes the audit trail. */
import type { Comp } from '@/engine/comps'
import type { Db } from './db'
import { parseComp, type CompErrors } from './comps/parse-comp'
import type { RawComp } from './comps/provider'
import type { User } from './users'

export interface CompRecord extends Comp {
  id: string
  dealId: string
  origin: 'manual' | 'import'
  externalId: string | null
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

type Row = Record<string, unknown>
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function toComp(r: Row): CompRecord {
  return {
    id: r.id as string,
    dealId: r.deal_id as string,
    address: r.address as string,
    salePrice: n(r.sale_price),
    saleDate: (r.sale_date_text as string | null) ?? null,
    sqft: n(r.sqft),
    beds: n(r.beds),
    baths: n(r.baths),
    distanceMiles: n(r.distance_miles),
    condition: (r.condition as string | null) ?? null,
    renovation: (r.renovation as Comp['renovation']) ?? null,
    saleStatus: (r.sale_status as Comp['saleStatus']) ?? null,
    tier: ((r.tier as Comp['tier']) ?? 'standard'),
    shareOverride: n(r.share_override),
    source: (r.source as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    included: Boolean(r.included),
    origin: r.origin as 'manual' | 'import',
    externalId: (r.external_id as string | null) ?? null,
    createdBy: r.created_by as string,
    updatedBy: r.updated_by as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

/** Snapshot kept in the audit trail. */
export function compSnapshot(c: Comp): Record<string, unknown> {
  const { address, salePrice, saleDate, sqft, beds, baths, distanceMiles, condition, renovation, saleStatus, tier, shareOverride, source, sourceUrl, notes, included } = c
  return { address, salePrice, saleDate, sqft, beds, baths, distanceMiles, condition, renovation, saleStatus, tier, shareOverride, source, sourceUrl, notes, included }
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)
const SELECT = `select *, to_char(sale_date, 'YYYY-MM-DD') as sale_date_text from deal_comps`
const values = (c: Comp) => [
  c.address, c.salePrice, c.saleDate, c.sqft, c.beds, c.baths, c.distanceMiles,
  c.condition, c.renovation, c.source, c.sourceUrl, c.notes, c.included, c.saleStatus, c.tier, c.shareOverride,
]

export function compsRepo(db: Db) {
  async function audit(dealId: string, oldV: unknown, newV: unknown, user: User) {
    await db.query(
      `insert into deal_audit (deal_id, field, old_value, new_value, changed_by) values ($1,'comps',$2::text::jsonb,$3::text::jsonb,$4)`,
      [dealId, JSON.stringify(oldV ?? null), JSON.stringify(newV ?? null), user],
    )
    await db.query(`update deals set updated_at = now(), updated_by = $2 where id = $1`, [dealId, user])
  }

  async function insert(dealId: string, c: Comp, user: User, origin: 'manual' | 'import', externalId: string | null) {
    const rows = await db.query<{ id: string }>(
      `insert into deal_comps (deal_id, address, sale_price, sale_date, sqft, beds, baths, distance_miles,
         condition, renovation, source, source_url, notes, included, sale_status, tier, share_override, origin, external_id, created_by, updated_by)
       values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) returning id`,
      [dealId, ...values(c), origin, externalId, user],
    )
    await audit(dealId, null, compSnapshot(c), user)
    return rows[0].id
  }

  return {
    async list(dealId: string): Promise<CompRecord[]> {
      if (!isUuid(dealId)) return []
      const rows = await db.query<Row>(`${SELECT} where deal_id = $1 order by sale_date desc nulls last, created_at`, [dealId])
      return rows.map(toComp)
    },

    async get(dealId: string, id: string): Promise<CompRecord | null> {
      if (!isUuid(dealId) || !isUuid(id)) return null
      const rows = await db.query<Row>(`${SELECT} where deal_id = $1 and id = $2`, [dealId, id])
      return rows[0] ? toComp(rows[0]) : null
    },

    /** Manual entry. */
    add(dealId: string, c: Comp, user: User): Promise<string> {
      return insert(dealId, c, user, 'manual', null)
    },

    async update(dealId: string, id: string, c: Comp, user: User): Promise<boolean> {
      const before = await this.get(dealId, id)
      if (!before) return false
      const oldSnap = compSnapshot(before)
      const newSnap = compSnapshot(c)
      if (JSON.stringify(oldSnap) === JSON.stringify(newSnap)) return true
      await db.query(
        `update deal_comps set address=$3, sale_price=$4, sale_date=$5::date, sqft=$6, beds=$7, baths=$8,
           distance_miles=$9, condition=$10, renovation=$11, source=$12, source_url=$13, notes=$14, included=$15,
           sale_status=$16, tier=$17, share_override=$18, updated_by=$19, updated_at=now() where deal_id=$1 and id=$2`,
        [dealId, id, ...values(c), user],
      )
      await audit(dealId, oldSnap, newSnap, user)
      return true
    },

    async remove(dealId: string, id: string, user: User): Promise<boolean> {
      const before = await this.get(dealId, id)
      if (!before) return false
      await db.query(`delete from deal_comps where deal_id = $1 and id = $2`, [dealId, id])
      await audit(dealId, compSnapshot(before), null, user)
      return true
    },

    /**
     * Automated import (step 2). Validates every record with the manual-entry
     * parser; skips invalid records and ones already imported (same source + externalId).
     */
    async importComps(
      dealId: string,
      source: string,
      raw: RawComp[],
      user: User,
    ): Promise<{ added: number; duplicates: number; invalid: { externalId: string; errors: CompErrors }[] }> {
      const existing = new Set(
        (
          await db.query<{ external_id: string }>(
            `select external_id from deal_comps where deal_id = $1 and source = $2 and external_id is not null`,
            [dealId, source],
          )
        ).map((r) => r.external_id),
      )
      let added = 0
      let duplicates = 0
      const invalid: { externalId: string; errors: CompErrors }[] = []
      for (const r of raw) {
        if (existing.has(r.externalId)) {
          duplicates++
          continue
        }
        const fields: Record<string, string | undefined> = { ...r, source, included: 'true' }
        const { comp, errors } = parseComp((k) => fields[k] ?? null)
        if (Object.keys(errors).length > 0) {
          invalid.push({ externalId: r.externalId, errors })
          continue
        }
        await insert(dealId, comp, user, 'import', r.externalId)
        existing.add(r.externalId)
        added++
      }
      return { added, duplicates, invalid }
    },
  }
}
