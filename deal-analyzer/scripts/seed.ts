/**
 * Demo data for local exploration ONLY. Every number is an illustrative
 * placeholder to exercise the engine — not market data. Addresses are prefixed [DEMO].
 */
import { sampleInputs } from '../src/engine/fixtures'
import { getDb } from '../src/lib/db'
import { dealsRepo } from '../src/lib/deals-repo'
import { compsRepo } from '../src/lib/comps-repo'
import { parseComp } from '../src/lib/comps/parse-comp'
import { syncCompSummary } from '../src/lib/comp-summary'

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
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
