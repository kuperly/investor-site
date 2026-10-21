import { beforeAll, describe, expect, it } from 'vitest'
import { bootstrapAdmin } from './auth/bootstrap'
import { getDb, type Db } from './db'
import { usersRepo } from './users-repo'

process.env.PGLITE_DIR = 'memory://'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

const uniq = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

describe(`users (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  let db: Db
  beforeAll(async () => {
    db = await getDb()
  })

  it('bootstraps the first admin from env only while there are no users', async () => {
    if ((await usersRepo(db).count()) === 0) {
      expect(await bootstrapAdmin(db, { ADMIN_USERNAME: 'Guy', ADMIN_PASSWORD: 'short' })).toBe(false) // weak password
      expect(await bootstrapAdmin(db, { ADMIN_USERNAME: 'guy', ADMIN_PASSWORD: 'a-long-enough-pass', ADMIN_DISPLAY_NAME: 'Guy' })).toBe(true)
      const u = await usersRepo(db).authenticate('guy', 'a-long-enough-pass')
      expect(u).toMatchObject({ username: 'guy', displayName: 'Guy', role: 'admin' })
    }
    expect(await bootstrapAdmin(db, { ADMIN_USERNAME: 'other', ADMIN_PASSWORD: 'a-long-enough-pass' })).toBe(false)
  })

  it('authenticates, rejects wrong passwords and inactive accounts, and audits changes', async () => {
    const repo = usersRepo(db)
    const name = uniq()
    const id = await repo.create({ username: name, displayName: `D ${name}`, role: 'member', password: 'first-password-1' }, 'Tester')
    expect(await repo.authenticate(name.toUpperCase(), 'first-password-1')).toMatchObject({ id })
    expect(await repo.authenticate(name, 'wrong-password-1')).toBeNull()

    const before = (await repo.get(id))!.sessionVersion
    await repo.setPassword(id, 'second-password-2', 'Tester')
    expect((await repo.get(id))!.sessionVersion).toBe(before + 1) // old sessions end
    expect(await repo.authenticate(name, 'first-password-1')).toBeNull()
    expect(await repo.authenticate(name, 'second-password-2')).not.toBeNull()

    await repo.update(id, { active: false }, 'Tester')
    expect(await repo.authenticate(name, 'second-password-2')).toBeNull()
    const h = await repo.history(id)
    expect(h.map((x) => x.action)).toEqual(['updated', 'password_changed', 'created'])
    expect(JSON.stringify(h)).not.toContain('second-password-2')
  })

  it('never leaves the system without an active admin', async () => {
    const repo = usersRepo(db)
    const admins = (await repo.list()).filter((u) => u.role === 'admin' && u.active)
    for (const a of admins.slice(1)) await repo.update(a.id, { active: false }, 'Tester')
    await expect(repo.update(admins[0].id, { role: 'member' }, 'Tester')).rejects.toThrow(/active admin/)
  })

  it('usernames and display names are unique', async () => {
    const repo = usersRepo(db)
    const name = uniq()
    await repo.create({ username: name, displayName: `N ${name}`, role: 'member', password: 'a-long-enough-pass' }, 'T')
    await expect(repo.create({ username: name, displayName: `M ${name}`, role: 'member', password: 'a-long-enough-pass' }, 'T')).rejects.toThrow()
    await expect(repo.create({ username: uniq(), displayName: `N ${name}`, role: 'member', password: 'a-long-enough-pass' }, 'T')).rejects.toThrow()
  })
})
