/** Browser sign-in under the current basePath: wrong password, success, session revocation, sign-out. */
import { chromium } from 'playwright-core'
import { ADMIN } from './login.mjs'
const BASE = process.env.E2E_BASE_URL
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✓', m) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await (await browser.newContext()).newPage()
await page.goto(BASE + '/markets')
ok(page.url().includes('/login?next=%2Fmarkets'), 'browser: signed out → /login (returns to the page afterwards)')
await page.fill('#username', ADMIN.username); await page.fill('#password', 'not-the-password')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('text=Wrong username or password')
ok(true, 'browser: wrong password refused')
await page.fill('#password', ADMIN.password)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('text=Sign out')
ok(new URL(page.url()).pathname.endsWith('/markets'), 'browser: signed in → back on /markets')
const cookie = (await page.context().cookies()).find((c) => c.name === 'vf_session')
ok(cookie && cookie.httpOnly && cookie.sameSite === 'Lax', 'session cookie is httpOnly + SameSite=Lax')
// Sign out everywhere revokes the token: a copy of the old cookie no longer works.
const stolen = await browser.newContext(); await stolen.addCookies([cookie])
const sp = await stolen.newPage(); await sp.goto(BASE + '/'); ok(!sp.url().includes('/login'), 'copied cookie works before revocation')
await page.goto(BASE + '/account')
await page.getByRole('button', { name: 'Sign out on every device' }).click()
await page.waitForSelector('#username')
await sp.goto(BASE + '/'); ok(sp.url().includes('/login'), 'after "sign out everywhere" the old cookie is refused')
await browser.close()
