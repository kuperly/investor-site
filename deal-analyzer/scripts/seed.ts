/**
 * Demo data for local exploration ONLY. Every number is an illustrative
 * placeholder to exercise the engine — not market data. Addresses and market names are
 * prefixed [DEMO]; demo markets use codes 99901–99906, which are not real CBSAs.
 */
import { sampleInputs } from '../src/engine/fixtures'
import { getDb } from '../src/lib/db'
import { dealsRepo } from '../src/lib/deals-repo'
import { compsRepo } from '../src/lib/comps-repo'
import { parseComp } from '../src/lib/comps/parse-comp'
import { syncCompSummary } from '../src/lib/comp-summary'
import { rankedGeo } from '../src/market/engine/fixtures'
import { geoRepo, observationsRepo } from '../src/market/lib/repo'

async function main() {
  const db = await getDb()
  const repo = dealsRepo(db)
  const comps = compsRepo(db)
  const demos = [
    {
      status: 'Analyzing' as const,
      notes: { general: 'Demo: complete underwriting, all gates cleared.' },
      inputs: sampleInputs({ address: '[DEMO] 123 Example St', market: 'Demo Market A', zip: '44100' }),
    },
    {
      status: 'Investigate' as const,
      notes: { nextSteps: 'Demo: get insurance quote and lender DSCR minimum.' },
      inputs: sampleInputs({
        address: '[DEMO] 48 Unknown Insurance Rd',
        market: 'Demo Market A',
        zip: '44102',
        insuranceAnnual: null,
        refiMinDscr: null,
        arvConfidence: 'Medium',
        gateTitleIssue: 'unknown',
      }),
    },
    {
      status: 'Lead' as const,
      notes: { general: 'Demo: strong flip, weak rent → negative post-refi cash flow hard gate.' },
      inputs: sampleInputs({
        address: '[DEMO] 7 Flip Only Ln',
        market: 'Demo Market B',
        zip: '30310',
        purchasePrice: 90_000,
        arvBase: 215_000,
        arvConservative: 200_000,
        arvUpside: 230_000,
        marketRent: 1_350,
        conservativeRent: 1_250,
        upsideRent: 1_450,
        rehabComplexity: 'Heavy',
      }),
    },
    {
      status: 'Offer' as const,
      notes: { general: 'Demo: thin equity — score in the INVESTIGATE band.' },
      inputs: sampleInputs({
        address: '[DEMO] 910 Thin Margin Ave',
        market: 'Demo Market B',
        zip: '30312',
        purchasePrice: 100_000,
        arvConservative: 165_000,
        arvBase: 180_000,
        arvUpside: 195_000,
        arvConfidence: 'Medium',
      }),
    },
  ]
  for (const d of demos) {
    const id = await repo.create(d.inputs, d.notes, d.status, 'Guy')
    if (d === demos[0]) {
      // Illustrative comps only — fictitious addresses, not market data.
      const demoComps: Record<string, string>[] = [
        { address: '[DEMO] 101 Sample Ave', salePrice: '205000', saleDate: '2026-07-15', sqft: '1380', beds: '3', baths: '2', distanceMiles: '0.3', condition: 'Full renovation', renovation: 'renovated', saleStatus: 'sold', tier: 'superComp', source: 'Manual' },
        { address: '[DEMO] 77 Placeholder Rd', salePrice: '198000', saleDate: '2026-05-02', sqft: '1450', beds: '3', baths: '1.5', distanceMiles: '0.6', condition: 'Updated kitchen/baths', renovation: 'renovated', saleStatus: 'sold', source: 'Manual' },
        { address: '[DEMO] 9 Fixture Ct', salePrice: '118000', saleDate: '2026-03-20', sqft: '1350', beds: '3', baths: '1', distanceMiles: '0.5', condition: 'Original, dated', renovation: 'unrenovated', saleStatus: 'sold', source: 'Manual' },
      ]
      for (const c of demoComps) await comps.add(id, parseComp((k) => c[k] ?? null).comp, 'Guy')
      await syncCompSummary(db, id, 'Guy')
    }
    console.log(`Seeded ${d.inputs.address} → /deals/${id}`)
  }

  // [DEMO] VF-03 markets: synthetic evidence, ordered so Market F is strongest. Not real data.
  const geos = geoRepo(db)
  const obs = observationsRepo(db)
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']
  const asOf = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  for (let i = 0; i < letters.length; i++) {
    const id = await geos.create({ level: 'msa', code: `9990${i + 1}`, name: `[DEMO] Market ${letters[i]}`, parentId: null, state: 'OH' }, 'Guy')
    const g = (await geos.get(id))!
    for (const o of rankedGeo(g, i, { asOf, confidence: i === 2 ? 'single_secondary' : 'official_primary' }).observations)
      await obs.insert({ ...o, source: '[DEMO] synthetic — not real data' }, { errors: [], methodologyVersion: 'demo', runId: null, enteredBy: 'seed' })
    const units = 80_000 + 20_000 * i
    const dist = { bins: [['1_detached', 0.6], ['1_attached', 0.05], ['2', 0.06], ['3_4', 0.07], ['5_9', 0.08], ['10_19', 0.06], ['20_49', 0.04], ['50_plus', 0.04]].map(([key, share]) => ({ key: String(key), label: String(key), lo: null, hi: null, count: Math.round(units * Number(share)) })) }
    for (const [metric, value, detail] of [['acs.housing_units', units, null], ['acs.renter_occupied', Math.round(units * 0.35), null], ['acs.units_in_structure_dist', units, dist]] as const)
      await obs.insert(
        { geoId: id, metric, value, unit: metric.endsWith('_dist') ? 'distribution' : 'count', detail, source: '[DEMO] synthetic — not real data', sourceUrl: null, asOf, retrievedAt: new Date().toISOString(), confidence: 'official_primary', methodology: 'demo' },
        { errors: [], methodologyVersion: 'demo', runId: null, enteredBy: 'seed' },
      )
    console.log(`Seeded [DEMO] Market ${letters[i]} → /markets/${id}`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
