/** ValeForge default assumptions (set by Guy/Ben). Every change is recorded in settings_history. */
import { DEFAULTABLE_KEYS, isDefaultable, type DealDefaults } from '@/engine/fields'
import type { Db } from './db'
import type { User } from './users'

const KEY = 'deal_defaults'

export interface SettingsChange {
  id: number
  field: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt: Date
}

export function settingsRepo(db: Db) {
  return {
    async getDefaults(): Promise<DealDefaults> {
      const rows = await db.query<{ value: unknown }>('select value from settings where key = $1', [KEY])
      const raw = rows[0]?.value
      const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | undefined
      if (!obj) return {}
      // Only known defaultable keys survive (ignores stale keys if the list changes).
      return Object.fromEntries(Object.entries(obj).filter(([k, v]) => isDefaultable(k) && v !== null)) as DealDefaults
    },

    /** Replaces the defaults; returns the number of changed fields. */
    async saveDefaults(next: DealDefaults, user: User): Promise<number> {
      const current = await this.getDefaults()
      const changed = DEFAULTABLE_KEYS.filter(
        (k) => JSON.stringify(current[k] ?? null) !== JSON.stringify(next[k] ?? null),
      )
      if (changed.length === 0) return 0
      await db.query(
        `insert into settings (key, value, updated_by) values ($1, $2::text::jsonb, $3)
         on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
        [KEY, JSON.stringify(next), user],
      )
      for (const k of changed) {
        await db.query(
          `insert into settings_history (key, field, old_value, new_value, changed_by) values ($1,$2,$3::text::jsonb,$4::text::jsonb,$5)`,
          [KEY, k, JSON.stringify(current[k] ?? null), JSON.stringify(next[k] ?? null), user],
        )
      }
      return changed.length
    },

    async history(limit = 30): Promise<SettingsChange[]> {
      const rows = await db.query<Record<string, unknown>>(
        'select * from settings_history where key = $1 order by changed_at desc, id desc limit $2',
        [KEY, limit],
      )
      return rows.map((r) => ({
        id: Number(r.id),
        field: r.field as string,
        oldValue: r.old_value,
        newValue: r.new_value,
        changedBy: r.changed_by as string,
        changedAt: new Date(r.changed_at as string),
      }))
    },
  }
}
