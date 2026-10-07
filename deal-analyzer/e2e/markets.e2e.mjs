/** VF-03 Market Intelligence end to end (uses the [DEMO] markets from scripts/seed.ts). */
import { chromium } from 'playwright-core'
import { ADMIN, signIn } from './login.mjs'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const OUT = process.env.E2E_OUT || new URL('./.out', import.meta.url).pathname
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }))
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✓', m) }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const main = () => page.locator('main').innerText()
const row = (name) => page.locator('tr', { hasText: name })

await signIn(page, BASE, ADMIN)
await page.goto(BASE + '/markets')
ok((await main()).includes('[DEMO] Market F') && (await main()).includes('Not evaluated yet'), 'markets list shows the research queue before evaluation')

await page.getByRole('button', { name: 'Evaluate now' }).click()
await row('[DEMO] Market F').getByText('DRILL DOWN').waitFor()
ok((await row('[DEMO] Market F').innerText()).includes('DRILL DOWN'), 'strongest market → DRILL DOWN (strong parent-level signal)')
ok((await row('[DEMO] Market A').innerText()).includes('DROP'), 'weakest market with good evidence → DROP')
ok(!/\bBUY\b|\bPASS\b/.test(await page.locator('table').first().innerText()), 'market decisions never use BUY / PASS')
const c = await row('[DEMO] Market C').innerText()
ok(/≈\d+|\d+–\d+/.test(c) && !/#\d/.test(c) && c.includes('WATCH'), 'low-confidence market: approximate score, no rank, WATCH (not DROP or KEEP)')
await page.screenshot({ path: `${OUT}/17-markets-list.png`, fullPage: true })

await page.getByRole('link', { name: '[DEMO] Market F' }).click()
await page.waitForSelector('text=Strategy matrix')
let body = await main()
ok(body.includes('Strong parent-level signal'), 'decision reasons are explained')
ok(body.includes('Market Quality') && body.includes('Opportunity Density') && body.includes('Capital Efficiency') && body.includes('Strategy Fit'), 'all four core dimensions broken down')
ok(body.includes('Raw evidence and provenance') && body.includes('[DEMO] synthetic — not real data'), 'raw evidence with its source is shown, never hidden behind the score')
ok(body.includes('Section 8 / HCV') && /overlay/i.test(body), 'strategy matrix includes the Section 8 overlay')
await page.screenshot({ path: `${OUT}/18-market-detail.png`, fullPage: true })

// Conditional drill-down: ZIPs can only be added after promotion; the promotion stores why.
ok((await page.locator('summary', { hasText: 'Add a Submarket' }).count()) === 0, 'children cannot be added before promotion')
await page.getByRole('button', { name: 'Promote for drill-down' }).click()
await page.waitForSelector('text=Promoted by Guy')
body = await main()
ok(/Promoted by Guy/.test(body) && body.includes('Priority ≥'), 'promotion recorded with its reasons')
await page.locator('summary', { hasText: 'Add a Submarket' }).click()
await page.selectOption('select[name=level]', 'zcta')
await page.fill('input[name=code]', '99960'); await page.fill('input[name=name]', '[DEMO] ZIP 99960')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForSelector('text=Added [DEMO] ZIP 99960')
ok(true, 'ZIP added under the promoted market')
const fUrl = page.url()

// Hard risk flag: critical blocks regardless of score.
await page.goto(BASE + '/markets/cbsa%3A99905')
await page.locator('summary', { hasText: 'Add a hard risk flag' }).click()
const ff = page.locator('form:has(select[name=severity])')
await ff.locator('select[name=severity]').selectOption('critical')
await ff.locator('input[name=category]').fill('Regulatory'); await ff.locator('input[name=reason]').fill('[DEMO] proposed rental moratorium'); await ff.locator('input[name=source]').fill('[DEMO] test')
await page.getByRole('button', { name: 'Add flag' }).click()
await page.waitForSelector('text=Flag added')

// Manual evidence needs a source (validated server-side too).
await page.goto(fUrl)
await page.locator('summary', { hasText: 'Enter evidence by hand' }).click()
const mf = page.locator('form:has(select[name=metric])')
await mf.locator('select[name=metric]').selectOption('opp.foreclosure_per_1000')
await mf.locator('input[name=value]').fill('4.2'); await mf.locator('input[name=asOf]').fill('2026-06-30'); await mf.locator('input[name=source]').fill('[DEMO] county court records')
await mf.locator('select[name=confidence]').selectOption('verified_local_commercial')
await page.getByRole('button', { name: 'Record' }).click()
await page.waitForSelector('text=Recorded Foreclosure filings')
ok(true, 'manual evidence recorded with its source and confidence')

// Re-evaluate: promoted market → KEEP, change explained; flagged market blocked.
await page.goto(BASE + '/markets')
await page.getByRole('button', { name: 'Evaluate now' }).click()
await row('[DEMO] Market F').getByText('KEEP').waitFor()
ok((await row('[DEMO] Market F').innerText()).includes('KEEP'), 'after promotion the market is KEEP')
ok(/BLOCKED[\s\S]*DROP/.test(await row('[DEMO] Market E').innerText()), 'critical hard flag → BLOCKED, DROP')
ok((await row('[DEMO] ZIP 99960').count()) === 1, 'the ZIP is now analyzed (parent promoted)')
await page.goto(fUrl)
body = await main()
ok(/Why it changed[\s\S]*Decision DRILL_DOWN → KEEP/.test(body), 'change detection explains the decision change')
ok(/History[\s\S]*DRILL DOWN/.test(body), 'snapshot history kept')

// Avatar
await page.goto(BASE + '/markets/avatars')
await page.fill('#av-name', '[DEMO] 3BR workforce SFH')
await page.check('input[name=propertyTypes][value=sfh_detached]')
await page.fill('#av-bedsMin', '3'); await page.fill('#av-bedsMax', '3'); await page.fill('#av-yearBuiltMin', '1940'); await page.fill('#av-yearBuiltMax', '1980')
await page.fill('#av-rent', '1400'); await page.check('input[name=strategies][value=brrrr]')
await page.getByRole('button', { name: 'Create avatar' }).click()
await page.waitForSelector('td:has-text("[DEMO] 3BR workforce SFH")')
ok(true, 'avatar created (no built-in avatar)')

// Candidate → Deal Analyzer
await page.goto(BASE + '/markets/candidates')
await page.selectOption('#c-geo', { label: '[DEMO] ZIP 99960 (ZIP (ZCTA))' })
await page.selectOption('#c-avatar', { label: '[DEMO] 3BR workforce SFH' })
await page.fill('#c-addr', '[DEMO] 12 Candidate Ct'); await page.selectOption('#c-type', 'SFR')
await page.fill('#c-beds', '3'); await page.fill('#c-askingPrice', '110000'); await page.fill('#c-estArv', '200000'); await page.fill('#c-estRehab', '45000'); await page.fill('#c-estRent', '1500')
await page.fill('#c-src', '[DEMO] agent off-market list')
await page.getByRole('button', { name: 'Add candidate' }).click()
await page.waitForSelector('text=Candidate [DEMO] 12 Candidate Ct added')
await page.screenshot({ path: `${OUT}/19-candidates.png`, fullPage: true })
await page.locator('tr', { hasText: '[DEMO] 12 Candidate Ct' }).getByRole('button', { name: 'Send to Deal Analyzer' }).click()
await page.waitForURL(/\/deals\/[0-9a-f-]{36}$/)
const handoffUrl = page.url()
body = await main()
ok(body.includes('[DEMO] 12 Candidate Ct') && /NOT applied/.test(body), 'hand-off created a deal; estimates are in the notes, marked NOT applied')
ok(/From Market Intelligence: candidate/.test(body), 'the deal links back to its market')
await page.goto(handoffUrl + '/edit')
await page.waitForSelector('input[name=askingPrice]')
ok((await page.inputValue('[name=askingPrice]')) === '110000' && (await page.inputValue('[name=beds]')) === '3', 'property facts and asking price filled from the candidate')
ok((await page.inputValue('[name=arvBase]')) === '' && (await page.inputValue('[name=rehabEstimate]')) === '' && (await page.inputValue('[name=marketRent]')) === '', 'ARV, rehab and rent NOT filled (Deal Analyzer stays the source of truth)')
await page.goto(handoffUrl)

// Feedback loop
await page.fill('#o-purchasePrice', '108000'); await page.fill('#o-actualCapitalRecovered', '41000')
await page.getByRole('button', { name: 'Save actual result' }).click()
await page.waitForSelector('text=Actual result saved')
ok(true, 'actual result recorded next to the predicted analysis')
await page.screenshot({ path: `${OUT}/20-deal-from-candidate.png`, fullPage: true })

// Methodology + configurable thresholds (admin), audited
await page.goto(BASE + '/markets/methodology')
body = await main()
ok(body.includes('VF03-SPEC') && body.includes('PROVISIONAL') && body.includes('INTERPRETATION'), 'every rule tagged with its provenance')
await page.fill('[id="decision.keepMinPriority"]', '75')
await page.getByRole('button', { name: 'Save thresholds' }).click()
await page.waitForSelector('text=Saved 1 change')
await page.reload()
ok((await main()).includes('decision.keepMinPriority: default → 75 · Guy'), 'threshold change recorded (who, old → new)')
await page.fill('[id="decision.keepMinPriority"]', '')
await page.getByRole('button', { name: 'Save thresholds' }).click()
await page.waitForSelector('text=Saved 1 change')

await page.goto(BASE + '/markets/ingestion')
ok((await main()).includes('U.S. Census Bureau — ACS 5-year') && (await main()).includes('Not configured'), 'data sources page shows which providers need keys')
await page.screenshot({ path: `${OUT}/21-data-sources.png`, fullPage: true })

// Mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await m.addCookies(await ctx.cookies())
const mp = await m.newPage()
for (const [url, name] of [[BASE + '/markets', '22-markets-mobile'], [fUrl, null]]) {
  await mp.goto(url)
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(overflow <= 0, `mobile: no horizontal page scroll at ${url.replace(BASE, '')} (overflow ${overflow}px)`)
  if (name) await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}
ok(errors.length === 0, 'no client-side JS errors ' + JSON.stringify(errors))
await browser.close()
