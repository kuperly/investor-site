import { chromium } from 'playwright-core'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const OUT = process.env.E2E_OUT || new URL('./.out', import.meta.url).pathname
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }))
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✓', m) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())

await page.goto(BASE)
await page.getByRole('button', { name: 'Ben' }).click()
await page.waitForSelector('button[aria-pressed="true"]')
await page.getByRole('link', { name: '[DEMO] 123 Example St' }).first().click()
await page.waitForSelector('text=Comparable properties (3)')
ok(true, 'deal page shows seeded comps (3)')
await page.getByRole('link', { name: 'Manage comps' }).click()
await page.waitForSelector('#comp-form')
const url = page.url()

// validation
await page.fill('#c_salePrice', 'abc'); await page.fill('#c_sourceUrl', 'javascript:alert(1)')
await page.getByRole('button', { name: 'Add comp' }).click()
await page.waitForSelector('text=Address is required')
ok(await page.isVisible('text=Must start with http:// or https://'), 'validation: address required, unsafe link rejected')

// add manually, sqft left unknown
await page.fill('#c_address', '55 Manual Entry Ln'); await page.fill('#c_salePrice', '$212,500'); await page.fill('#c_saleDate', '2026-08-20')
await page.fill('#c_sqft', ''); await page.fill('#c_beds', '3'); await page.fill('#c_baths', '2'); await page.fill('#c_distanceMiles', '0.4')
await page.fill('#c_condition', 'Renovated 2025'); await page.selectOption('#c_renovation', 'renovated'); await page.fill('#c_source', 'Redfin')
await page.fill('#c_sourceUrl', 'https://www.redfin.com/example'); await page.fill('#c_notes', 'Corner lot')
await page.getByRole('button', { name: 'Add comp' }).click()
await page.waitForSelector('text=55 Manual Entry Ln')
let body = await page.locator('main').innerText()
ok(body.includes('Comps (4)'), 'manual comp added (4 comps)')
ok(/55 Manual Entry Ln[\s\S]*\$212,500[\s\S]*UNKNOWN/.test(body), 'unknown sqft shown as UNKNOWN (and $/sqft UNKNOWN), not $0')
ok(body.includes('3 (2 priced)') === false, 'stats sane')
await page.screenshot({ path: `${OUT}/10-comps-page.png`, fullPage: true })

// edit
const row = page.locator('tr', { hasText: '55 Manual Entry Ln' })
await row.getByRole('link', { name: 'Edit' }).click()
await page.waitForSelector('text=Edit comp')
ok((await page.inputValue('#c_salePrice')) === '212500', 'edit form pre-filled')
await page.fill('#c_salePrice', '209000'); await page.fill('#c_sqft', '1400')
await page.getByRole('button', { name: 'Save comp' }).click()
await page.waitForSelector('text=Add comp')
body = await page.locator('main').innerText()
ok(/55 Manual Entry Ln[\s\S]*\$209,000[\s\S]*\$149/.test(body), 'edit saved; $/sqft computed (209,000/1,400 ≈ $149)')

// exclude unrenovated outlier, then delete one
await page.locator('tr', { hasText: '9 Fixture Ct' }).getByRole('button', { name: 'Exclude' }).click()
await page.waitForSelector('text=1 comp(s) excluded from statistics.')
ok(true, 'exclude: comp kept but left out of stats')
await page.locator('tr', { hasText: '77 Placeholder Rd' }).getByRole('button', { name: 'Delete' }).click()
await page.waitForFunction(() => !document.body.innerText.includes('77 Placeholder Rd'))
ok(true, 'delete (with confirmation)')

// apply summary
const applyBtn = page.getByRole('button', { name: /Apply list values to deal/ })
ok(await applyBtn.isVisible(), 'deal summary differs from list → Apply offered')
await applyBtn.click()
await page.waitForFunction(() => !document.body.innerText.includes('Apply list values'))
ok(true, 'summary applied; fields now match the list')

// audit on deal page
await page.goto(url.replace('/comps', ''))
body = await page.locator('main').innerText()
ok(body.includes('Comp added') && body.includes('55 Manual Entry Ln · $212,500 · 2026-08-20'), 'audit: comp added')
ok(body.includes('sale price: $212,500 → $209,000'), 'audit: comp edit shows old → new')
ok(body.includes('Comp removed'), 'audit: comp removed')
ok(body.includes('Number of comps') && body.includes('Changed by Ben'), 'audit: applied summary fields, by Ben')
await page.locator('h2:has-text("Audit trail")').locator('..').screenshot({ path: `${OUT}/11-comps-audit.png` })

// export includes comps
await page.goto(url.replace('/comps', '/export'))
ok((await page.locator('main').innerText()).includes('55 Manual Entry Ln'), 'export includes comps')

// mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await m.addCookies([{ name: 'vf_user', value: 'Ben', url: BASE }])
const mp = await m.newPage()
await mp.goto(url)
ok((await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'mobile: no horizontal scroll on comps page')
await mp.screenshot({ path: `${OUT}/12-comps-mobile.png`, fullPage: true })
ok(errors.length === 0, 'no client JS errors ' + JSON.stringify(errors))
await browser.close()
