/** Accounts. Password hashes never leave this module. */
import { hashPassword, verifyPassword } from './auth/password'
import type { Db } from './db'
import type { Role, SessionUser, User } from './users'

export interface UserRecord extends SessionUser {
  active: boolean
  sessionVersion: number
  createdAt: Date
}

type Row = Record<string, unknown>

const toUser = (r: Row): UserRecord => ({
  id: r.id as string,
  username: r.username as string,
  displayName: r.display_name as string,
  role: r.role as Role,
  active: Boolean(r.active),
  sessionVersion: Number(r.session_version),
  createdAt: new Date(r.created_at as string),
})

const UUID_RE = /^[0-9a-f-]{36}$/i

export function usersRepo(db: Db) {
  const audit = (q: Db, userId: string, action: string, detail: unknown, by: User) =>
    q.query('insert into user_audit (user_id, action, detail, changed_by) values ($1,$2,$3::text::jsonb,$4)', [
      userId,
      action,
      JSON.stringify(detail ?? null),
      by,
    ])

  return {
    async count(): Promise<number> {
      const [r] = await db.query<{ n: number }>('select count(*)::int as n from users')
      return Number(r.n)
    },

    async list(): Promise<UserRecord[]> {
      return (await db.query<Row>('select * from users order by display_name')).map(toUser)
    },

    async get(id: string): Promise<UserRecord | null> {
      if (!UUID_RE.test(id)) return null
      const [r] = await db.query<Row>('select * from users where id = $1', [id])
      return r ? toUser(r) : null
    },

    /** Returns the user only if the password matches and the account is active. */
    async authenticate(username: string, password: string): Promise<UserRecord | null> {
      const [r] = await db.query<Row>('select * from users where username = $1', [username.trim().toLowerCase()])
      if (!r) {
        // Same work as a real check, so timing doesn't reveal which usernames exist.
        await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA')
        return null
      }
      const ok = await verifyPassword(password, r.password_hash as string)
      return ok && r.active ? toUser(r) : null
    },

    async create(
      u: { username: string; displayName: string; role: Role; password: string },
      by: User,
    ): Promise<string> {
      const hash = await hashPassword(u.password)
      return db.transaction(async (tx) => {
        const [r] = await tx.query<{ id: string }>(
          `insert into users (username, display_name, role, password_hash, created_by) values ($1,$2,$3,$4,$5) returning id`,
          [u.username.trim().toLowerCase(), u.displayName.trim(), u.role, hash, by],
        )
        await audit(tx, r.id, 'created', { username: u.username, displayName: u.displayName, role: u.role }, by)
        return r.id
      })
    },

    /** New password; bumps session_version so every existing session ends. */
    async setPassword(id: string, password: string, by: User): Promise<void> {
      const hash = await hashPassword(password)
      await db.transaction(async (tx) => {
        await tx.query(
          'update users set password_hash = $2, session_version = session_version + 1, updated_at = now() where id = $1',
          [id, hash],
        )
        await audit(tx, id, 'password_changed', null, by)
      })
    },

    async signOutEverywhere(id: string, by: User): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.query('update users set session_version = session_version + 1, updated_at = now() where id = $1', [id])
        await audit(tx, id, 'signed_out_everywhere', null, by)
      })
    },

    /** Role / active changes. Refuses to leave the system without an active admin. */
    async update(id: string, next: { role?: Role; active?: boolean }, by: User): Promise<void> {
      await db.transaction(async (tx) => {
        const [cur] = await tx.query<Row>('select * from users where id = $1 for update', [id])
        if (!cur) throw new Error('User not found')
        const role = next.role ?? (cur.role as Role)
        const active = next.active ?? Boolean(cur.active)
        if (cur.role === 'admin' && cur.active && (role !== 'admin' || !active)) {
          const [r] = await tx.query<{ n: number }>(
            "select count(*)::int as n from users where role = 'admin' and active and id <> $1",
            [id],
          )
          if (Number(r.n) === 0) throw new Error('At least one active admin is required.')
        }
        await tx.query(
          `update users set role = $2, active = $3, updated_at = now(),
             session_version = session_version + (case when $3 then 0 else 1 end) where id = $1`,
          [id, role, active],
        )
        await audit(tx, id, 'updated', { role: [cur.role, role], active: [Boolean(cur.active), active] }, by)
      })
    },

    async history(id: string) {
      const rows = await db.query<Row>('select * from user_audit where user_id = $1 order by changed_at desc, id desc', [id])
      return rows.map((r) => ({
        action: r.action as string,
        detail: r.detail,
        changedBy: r.changed_by as string,
        changedAt: new Date(r.changed_at as string),
      }))
    },
  }
}
