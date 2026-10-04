import { chromium } from 'playwright-core'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const OUT = process.env.E2E_OUT || new URL('./.out', import.meta.url).pathname
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }))
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✓', m) }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE)
await page.getByRole('button', { name: 'Guy' }).click()
await page.waitForSelector('button[aria-pressed="true"]')
ok(true, 'user selected (Guy)')
await page.screenshot({ path: `${OUT}/01-dashboard-desktop.png`, fullPage: true })

// AC1/AC2: create a deal through the form
await page.getByRole('link', { name: '+ New Deal' }).click()
await page.waitForSelector('input[name=address]')
const fill = async (k, v) => page.fill(`[name=${k}]`, String(v))
const sel = async (k, v) => page.selectOption(`[name=${k}]`, v)
await fill('address', '1 E2E Test Way'); await fill('city', 'Testville'); await fill('state', 'OH'); await fill('zip', '44199'); await fill('market', 'E2E Market')
await sel('propertyType', 'Duplex')
await fill('purchasePrice', '125,000'); await fill('closingCostPct', '3'); for (const k of ['inspectionCost','attorneyCost','titleCost','otherAcquisitionCost','otherProjectCosts','additionalEquity']) await fill(k, '0')
await fill('projectMonths', '6'); await fill('holdingCosts', '3000')
await fill('rehabEstimate', '45000'); await fill('rehabContingencyPct', '10'); await sel('rehabComplexity', 'Medium')
await fill('acqLtv', '80'); await fill('acqInterestRate', '11'); await fill('acqPointsPct', '2'); await fill('acqLoanFees', '1500'); await fill('acqTermYears', '1'); await sel('acqInterestOnly', 'true')
await fill('refiLtv', '75'); await fill('refiInterestRate', '7.25'); await fill('refiTermYears', '30'); await fill('refiClosingCostPct', '2'); await fill('refiOtherCosts', '0')
await fill('arvConservative', '225000'); await fill('arvBase', '240000'); await fill('arvUpside', '255000'); await sel('arvConfidence', 'Medium')
await fill('marketRent', '2200'); await fill('conservativeRent', '2050'); await fill('upsideRent', '2350')
await fill('vacancyPct', '8'); await fill('managementPct', '10'); await fill('taxesAnnual', '3600'); await fill('hoaAnnual', '0'); await fill('utilitiesAnnual', '0'); await fill('maintenancePct', '5'); await fill('capexPct', '5'); await fill('otherOpexAnnual', '0')
await fill('sellingCostPct', '6')
// Insurance and lender min DSCR intentionally left blank → UNKNOWN
const livePreview = await page.locator('aside').innerText()
ok(livePreview.includes('All-in') && !/All-in\s*UNKNOWN/.test(livePreview), 'AC3: live preview computes All-in while typing')
ok(/insurance estimate required/.test(await page.locator('aside').textContent()), 'AC18: live preview lists insurance as UNKNOWN')
await page.screenshot({ path: `${OUT}/02-new-deal-form-live-preview.png`, fullPage: false })
await page.getByRole('button', { name: 'Create deal' }).click()
await page.waitForURL(/\/deals\/[0-9a-f-]{36}$/)
const dealUrl = page.url()
ok(true, 'AC1/AC15: deal saved → ' + dealUrl)
let body = await page.locator('main').innerText()
ok(body.includes('Underwriting incomplete — insurance estimate required.'), 'AC18: deal page shows the spec warning for missing insurance')
ok(/DSCR\s*UNKNOWN/.test(body), 'AC18: DSCR shown as UNKNOWN, not computed from $0 insurance')
ok(body.includes('INVESTIGATE') || body.includes('PASS'), 'AC14: incomplete deal is not a BUY')

// AC16: open the existing deal and edit it
await page.getByRole('link', { name: 'Edit' }).click()
await page.waitForSelector('input[name=insuranceAnnual]')
ok((await page.inputValue('[name=purchasePrice]')) === '125000', 'AC16: edit form re-opens with saved values')
await fill('purchasePrice', '115000'); await fill('insuranceAnnual', '1500'); await fill('refiMinDscr', '1.0')
for (const g of ['gateNoCredibleArv','gateTitleIssue','gateUninsurable','gateStructuralUnknownCost','gateAppreciationOnly','gateRehabNotEstimable']) await sel(g, 'no')
await page.fill('[name=note_general]', 'E2E edit: price negotiated down.')
await page.getByRole('button', { name: 'Save changes' }).click()
await page.waitForURL(dealUrl)
await page.waitForSelector('text=Audit trail')
body = await page.locator('main').innerText()
ok(body.includes('Old: $125,000 → New: $115,000'), '§33: audit trail records Old $125,000 → New $115,000')
ok(body.includes('Changed by Guy'), '§33: audit trail records who changed it')
ok(!body.includes('insurance estimate required'), 'insurance warning cleared after entering it')
const score = await page.locator('text=ValeForge Deal Score').locator('..').innerText()
console.log('   score block:', score.replace(/\n/g, ' '))
await page.screenshot({ path: `${OUT}/03-deal-analysis-desktop.png`, fullPage: true })
await page.locator('h2:has-text("Audit trail")').locator('..').screenshot({ path: `${OUT}/04-audit-trail.png` })

// Status change from the deal page
await page.selectOption('#status', 'Offer'); await page.getByRole('button', { name: 'Set' }).click()
await page.waitForTimeout(800)
await page.reload()
ok((await page.locator('#status').inputValue()) === 'Offer', 'status change persisted')

// AC: Export (PDF)
await page.goto(dealUrl + '/export')
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: `${OUT}/05-export-sample.pdf`, format: 'Letter', printBackground: true })
await page.emulateMedia({ media: 'screen' })
await page.screenshot({ path: `${OUT}/05-export-report.png`, fullPage: false })
ok(true, '§34: export rendered and saved as PDF')

// Methodology
await page.goto(BASE + '/methodology')
await page.screenshot({ path: `${OUT}/06-methodology.png`, fullPage: true })

// Dashboard filters
await page.goto(BASE + '/?rec=BUY')
const buyRows = await page.locator('table tbody tr').count()
await page.goto(BASE + '/?market=E2E+Market')
ok((await page.locator('table tbody tr').count()) === 1, 'dashboard market filter')
console.log('   BUY rows:', buyRows)

// AC20: mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const mp = await m.newPage()
for (const [url, name] of [[BASE, '07-dashboard-mobile'], [dealUrl, '08-deal-mobile'], [BASE + '/deals/new', '09-new-deal-mobile']]) {
  await mp.goto(url)
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(overflow <= 0, `AC20: no horizontal page scroll on mobile at ${name} (overflow ${overflow}px)`)
  await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: name !== '09-new-deal-mobile' })
}
ok(errors.length === 0, 'no client-side JS errors ' + JSON.stringify(errors))
await browser.close()
