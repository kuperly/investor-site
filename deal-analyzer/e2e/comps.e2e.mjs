import { chromium } from 'playwright-core'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const OUT = process.env.E2E_OUT || new URL('./.out', import.meta.url).pathname
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }))
import { MEMBER, signIn } from './login.mjs'
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✓', m) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())

await signIn(page, BASE, MEMBER)
await page.goto(BASE)
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
await page.selectOption('#c_saleStatus', 'pending'); await page.selectOption('#c_tier', 'bestFit')
ok(await page.isDisabled('#c_shareOverridePct'), '% override disabled for non-Super comps')
await page.getByRole('button', { name: 'Save comp' }).click()
await page.waitForSelector('text=Add comp')
body = await page.locator('main').innerText()
ok(/55 Manual Entry Ln[\s\S]*\$209,000[\s\S]*\$149/.test(body), 'edit saved; $/sqft computed (209,000/1,400 ≈ $149)')
ok(/55 Manual Entry Ln\s*Best fit/.test(body) && body.includes('Pending'), 'tier badge + status shown')

// % override on the Super comp
await page.locator('tr', { hasText: '101 Sample Ave' }).getByRole('link', { name: 'Edit' }).click()
await page.waitForSelector('text=Edit comp')
ok(await page.isEnabled('#c_shareOverridePct'), '% override enabled for Super comp')
await page.fill('#c_shareOverridePct', '50')
await page.getByRole('button', { name: 'Save comp' }).click()
await page.waitForSelector('text=Super comp · 50%')
ok(true, 'override saved; list shows "Super comp · 50%"')

// Comp-supported ARV: weighted table + Apply as Base ARV
const arvCard = page.locator('section', { has: page.locator('h2', { hasText: 'Comp-supported ARV' }) })
const arvText = await arvCard.innerText()
ok(/Super comp \(3×\)/.test(arvText) && /Best fit \(2×\)/.test(arvText), 'weights table shows tiers')
ok(/101 Sample Ave[^\n]*\n?[\s\S]*?50\.0%\s*fixed/.test(arvText), 'Super comp share fixed at 50.0%')
const shares = [...arvText.matchAll(/(\d+\.\d)%(?:\s*fixed)?\n/g)].map((m) => Number(m[1]))
ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 100) < 0.5, `shares add up to 100% (${shares.join(' + ')})`)
const suggested = arvText.match(/Comp-supported ARV\s*\n\s*\$([\d,]+)/)[1]
ok(arvText.includes('Fixture Ct (not marked renovated)'), 'unrenovated comp listed as not used for ARV')
await arvCard.screenshot({ path: `${OUT}/13-comp-arv.png` })
await arvCard.getByRole('button', { name: /Apply \$[\d,]+ as Base ARV/ }).click()
await page.waitForFunction(() => !/Apply \$[\d,]+ as Base ARV/.test(document.body.innerText))
ok((await page.locator('main').innerText()).includes(`(Conservative / Base / Upside): $185,000 / $${suggested} / $215,000`), `Base ARV now $${suggested}; Conservative/Upside unchanged`)

// exclude unrenovated outlier, then delete one
await page.locator('tr', { hasText: '9 Fixture Ct' }).getByRole('button', { name: 'Exclude' }).click()
await page.waitForSelector('text=1 comp(s) excluded from statistics.')
ok(true, 'exclude: comp kept but left out of stats')
await page.locator('tr', { hasText: '77 Placeholder Rd' }).getByRole('button', { name: 'Delete' }).click()
await page.waitForFunction(() => !document.body.innerText.includes('77 Placeholder Rd'))
ok(true, 'delete (with confirmation)')

// comp summary syncs automatically (no Apply button)
body = await page.locator('main').innerText()
ok(!body.includes('Apply list values'), 'no manual "apply summary" step any more')
const summaryRows = await page.locator('section:has(h2:text("Deal comp summary")) tbody tr.bg-amber-50').count()
ok(summaryRows === 0, 'deal comp summary matches the list after every change (no mismatched rows)')

// audit on deal page
await page.goto(url.replace('/comps', ''))
body = await page.locator('main').innerText()
ok(body.includes('Comp added') && body.includes('55 Manual Entry Ln · $212,500 · 2026-08-20'), 'audit: comp added')
ok(body.includes('sale price: $212,500 → $209,000'), 'audit: comp edit shows old → new')
ok(body.includes('Comp removed'), 'audit: comp removed')
ok(/Number of comps\s*Old: \d+ → New: \d+/.test(body) && body.includes('Changed by Ben'), 'audit: comp summary synced automatically, attributed to Ben')
ok(new RegExp(`Base ARV\\s*Old: \\$200,000 → New: \\$${suggested}`).test(body), 'audit: Base ARV old → new from comp ARV')
await page.locator('h2:has-text("Audit trail")').locator('..').screenshot({ path: `${OUT}/11-comps-audit.png` })

// export includes comps
await page.goto(url.replace('/comps', '/export'))
ok((await page.locator('main').innerText()).includes('55 Manual Entry Ln'), 'export includes comps')

// mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await m.addCookies(await ctx.cookies())
const mp = await m.newPage()
await mp.goto(url)
ok((await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'mobile: no horizontal scroll on comps page')
await mp.screenshot({ path: `${OUT}/12-comps-mobile.png`, fullPage: true })
ok(errors.length === 0, 'no client JS errors ' + JSON.stringify(errors))
await browser.close()
