/** Shared sign-in for the browser suites (real login; run.sh bootstraps the admin from env). */
export const ADMIN = { username: process.env.E2E_ADMIN_USER || 'guy', password: process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password', name: 'Guy' }
export const MEMBER = { username: 'ben', password: 'e2e-member-password', name: 'Ben' }

export async function signIn(page, base, who) {
  await page.goto(base + '/login')
  await page.fill('#username', who.username)
  await page.fill('#password', who.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.waitForSelector(`text=${who.name}`)
}
