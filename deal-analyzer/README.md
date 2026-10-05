# ValeForge Deal Analyzer — MVP

Internal underwriting engine for ValeForge. Enter a property and it evaluates
the deal as **BRRRR, Hold, Flip and Hybrid** in parallel (*the deal chooses the
strategy*). It returns All-in, Equity, Max Offer, Refi, DSCR, Cash Flow, Flip
profit, stress tests, a 100-point **ValeForge Deal Score** and a
**BUY / INVESTIGATE / PASS** recommendation. Hard gates always override the
score.

Full specification: [docs/SPEC.md](docs/SPEC.md). Every rule the engine
applies, with its source (SPEC / PROVISIONAL / INTERPRETATION), is listed on
the in-app **/methodology** page.

> This app lives in `deal-analyzer/` inside the `investor-site` repo, but it is
> a fully separate Next.js project with its own `package.json`. The marketing
> site's build, tests and Vercel deployment ignore this folder.

---

## Run locally

```bash
cd deal-analyzer
npm install
npm run db:seed     # optional: 4 clearly-labelled [DEMO] deals (illustrative numbers, not market data)
npm run dev         # http://localhost:3100
```

No database setup is needed: with no `DATABASE_URL`, the app uses **PGlite**
(real PostgreSQL compiled to WASM), stored in `./.data/pglite`. The schema is
applied automatically on first use.

To use PostgreSQL / Supabase instead:

```bash
cp .env.example .env.local      # set DATABASE_URL=postgres://…
npm run db:migrate              # applies db/schema.sql (idempotent)
npm run dev
```

| Command | What it does |
|---|---|
| `npm test` | Unit + integration tests (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run build` / `npm start` | Production build / server on :3100 |
| `TEST_DATABASE_URL=postgres://… npm test` | Also runs the repository tests against real PostgreSQL |
| `npm run check` | typecheck + lint + tests |
| `npm run e2e` | Isolated DB → seed → production build → Playwright acceptance suites (`e2e/`) |
| `npm run e2e:auth` | Builds at `/` and at `/vf-internal`, then checks every kind of path demands the password |

Pick **Guy** or **Ben** in the header before editing; the name is recorded on
every audit entry. Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` to put the
whole app behind HTTP Basic Auth. Do this for any deployed instance.

---

## Architecture

```
src/
  engine/            ← ALL business logic. Pure TypeScript: no React, no I/O.
    types.ts           DealInputs (every numeric input is number | null; null = UNKNOWN)
    config.ts          every threshold, tagged SPEC or PROVISIONAL, plus the methodology table
    fields.ts          field registry (label, kind, section): drives the form, parser and warnings
    finance.ts         amortization schedule, payment, remaining balance, interest-only
    formulas.ts        §10–§21 as one small pure function each, with guarded division
    underwrite.ts      composes formulas over nullable inputs → CoreResult; Max Offer solver
    stress.ts          §22 scenarios
    comps.ts           §32 comp statistics (renovated / unrenovated / all, $/sqft, distance, sale age)
    strategies.ts      §26 BRRRR / Hold / Flip / Hybrid + best use of capital
    gates.ts           §25 hard gates (computed + checklist)
    score.ts           §23 point functions
    recommendation.ts  §24 BUY / INVESTIGATE / PASS
    analyze.ts         analyzeDeal(inputs) → full DealAnalysis, including "Why?" text
  lib/               ← infrastructure (no business rules)
    db.ts              driver-agnostic Db: postgres.js (DATABASE_URL) or PGlite
    deals-repo.ts      CRUD + per-field audit rows
    comps-repo.ts      §32 comps: manual add/edit/delete + importComps() for automation, all audited
    comps/parse-comp.ts  one validator for manual entry AND imports (blank → UNKNOWN, http(s) links only)
    comps/provider.ts  CompProvider interface — where an automated data source plugs in
    audit.ts           diff of inputs / notes / status
    parse-inputs.ts    FormData → DealInputs (blank → null, % → decimal, type/range checks only)
    format.ts          display helpers ("UNKNOWN", "∞ (no cash left)", "N/A (no debt)")
  app/               ← Next.js 15 App Router UI (server components + server actions)
    page.tsx                 Deal Dashboard (filters, desktop table / mobile cards)
    deals/new, deals/[id], deals/[id]/edit, deals/[id]/export, methodology
  components/        AnalysisView (shared by deal page + export), DealForm (live preview), …
db/schema.sql        PostgreSQL schema (Supabase-compatible)
```

Design points:

- **One engine, three consumers.** The deal page, the dashboard and the PDF
  export all call `analyzeDeal()`. The form's live preview runs the same
  function in the browser. Nothing computes a financial number outside
  `src/engine`.
- **Analysis is computed, not stored.** The DB holds only inputs, notes and
  status. Every view recomputes, so a formula change applies to all deals
  immediately and stale cached numbers can't exist.
- **UNKNOWN propagates.** `lift(fn, …args)` returns `null` if any argument is
  unknown, and `InputReader` records which inputs were needed. The UI turns
  that list into spec-style warnings: *"Underwriting incomplete — insurance
  estimate required."*
- **Ready for integrations (§30).** A future Zillow/rent/tax importer only has
  to produce a partial `DealInputs`; the engine doesn't change. ARV and rehab
  are never auto-filled.

## Database schema

`db/schema.sql`:

| Table | Columns |
|---|---|
| `deals` | `id uuid pk`, `address`, `city`, `state`, `zip`, `market`, `status` (CHECK: the 9 spec statuses), `inputs jsonb` (all `DealInputs`; unknown = JSON `null`), `notes jsonb` (§31 categories), `created_by`, `updated_by`, `created_at`, `updated_at` |
| `deal_audit` | `id`, `deal_id → deals`, `field`, `old_value jsonb`, `new_value jsonb`, `changed_by`, `changed_at` (comp changes use `field = 'comps'` with before/after snapshots) |
| `deal_comps` | `id`, `deal_id → deals` (cascade), `address`, `sale_price`, `sale_date`, `sqft`, `beds`, `baths`, `distance_miles`, `condition`, `renovation` (`renovated` / `unrenovated` / null = unknown), `sale_status` (`sold` / `pending` / `active` / null), `tier` (`standard` / `bestFit` / `superComp`), `share_override` (fraction 0–1, Super comps only, null = computed weight), `source`, `source_url`, `notes`, `included`, `origin` (`manual` / `import`), `external_id` (unique per deal + source, so re-imports never duplicate), created/updated by/at |

The identity columns are copied out of `inputs` so the dashboard can filter in
SQL by market, ZIP, status and created date. Filters on computed values
(score, recommendation, strategy) run on engine output. Indexes cover
`status`, `market`, `zip`, `updated_at` and `(deal_id, changed_at)`.

## Implemented features

- Deal Dashboard: all 15 spec columns and all 7 filters (strategy = deals
  where that strategy is viable). Table on desktop, cards on mobile. Score is
  marked `*` when incomplete.
- New Deal / Edit form: every §5–§9 input, plus project months, holding costs,
  other project costs, additional equity, other refi costs, lender minimum
  DSCR, selling cost %, target All-in/ARV (default 70%) and a 6-item hard-gate
  checklist.
  - A live sidebar shows score, recommendation and key numbers as you type.
- Deal page:
  - Header: score, recommendation and the reasons behind it.
  - Data-integrity warnings, §27 key numbers, and the §28 "Why?" panel
    (strengths and risks generated from computed facts).
  - Strategy engine cards, ARV scenarios with Max Offer for all three ARVs,
    the 5 stress tests, score breakdown and hard gates.
  - All-in / rental / refi breakdowns, conservative case, notes and audit
    trail.
- Status workflow: all 9 statuses, settable from the deal page or the form.
- Audit trail (§33): one row per changed input, note or status, showing
  old → new, who changed it and when.
- Export (§34): a print-optimised report containing property, inputs,
  underwriting, BRRRR/Hold/Flip, stress tests, score, risks and
  recommendation, saved via the browser's "Save as PDF".
  [Sample PDF](docs/screenshots/05-export-sample.pdf).
- Methodology page listing every rule and its provenance.

## Acceptance criteria → evidence

| AC | Covered by |
|---|---|
| AC1 create deal · AC2 inputs · AC15 saved · AC16 reopen & edit | E2E run (Playwright) on PGlite and on PostgreSQL 16; `deals-repo.test.ts` |
| AC3 All-in · AC4 Equity | `underwrite.test.ts` hand-calculated example ($159,800 / $40,200) |
| AC5 Max Offer | hand calculation, plus an exact check that All-in at the Max Offer = ARV × 70% for IO, amortizing, closing-$ and all-cash loans |
| AC6 BRRRR · AC7 Refi · AC8 DSCR · AC9 Cash Flow | `underwrite.test.ts`, `formulas.test.ts` (incl. the spec's $60K / $54K = 90%) |
| AC10 Flip | `formulas.test.ts`, `underwrite.test.ts` |
| AC11 Stress | `analyze.test.ts`: the five scenarios and their directional effects |
| AC12 Score · AC14 Recommendation | `score.test.ts`, `recommendation.test.ts` (80 / 79.9 / 65 / 64.9 boundaries) |
| AC13 Hard gates | `analyze.test.ts`: checklist yes, DSCR < min, negative CF and no exit each force PASS on a 90-point deal |
| AC17 no ÷0 | `safeDivide`, CoC → ∞; a test walks every output with zero ARV / rent / rates / price and asserts no NaN or Infinity |
| AC18 UNKNOWN ≠ $0 | parser, engine, UI and E2E tests (missing insurance → DSCR "UNKNOWN" + spec warning) |
| AC19 testable formulas | every formula is an exported pure function in `src/engine` |
| AC20 mobile + desktop | E2E asserts no horizontal scroll at 390 px on dashboard, deal and form; screenshots below |

## Formula / unit tests

`npm test`: **155 tests, 12 files**, all passing (also against real PostgreSQL 16 via `TEST_DATABASE_URL`). `npm run e2e` adds 46 browser checks; `npm run e2e:auth` adds 37 password checks across `/` and basePath builds, plus the fail-closed case.

| File | Tests | Covers |
|---|---|---|
| `engine/finance.test.ts` | 11 | $150k @ 7% / 30y = $997.95; 0% rate; schedule pays to 0; interest + principal = payments; IO interest |
| `engine/formulas.test.ts` | 34 | every §10–§21 formula; ÷0 guards; Cash Left floor and released cash; CoC ∞ |
| `engine/underwrite.test.ts` | 20 | full worked example; amortizing acquisition; all-cash; released equity; Max Offer exactness (×4 financing modes); UNKNOWN propagation; no NaN/∞ |
| `engine/score.test.ts` | 7 | each component's scaling and clamps; risk factor unknowns; total / max achievable |
| `engine/recommendation.test.ts` | 12 | threshold boundaries; gate FAIL overrides; UNKNOWN blocks BUY; "can't reach 65" → PASS |
| `engine/analyze.test.ts` | 24 | end-to-end BUY deal; strategies; Max Offer ×3; stress; every computed gate; spec warning text; empty deal; Base-vs-comp-ARV "Why?" text |
| `lib/parse-inputs.test.ts` | 6 | blank → null; explicit 0 kept; `$125,000` and `7.5%` parsing; validation; round-trip |
| `lib/deals-repo.test.ts` | 6 | create/read; audit Old $125,000 → New $115,000 by Ben; no-op saves; filters; real `jsonb` storage |
| `engine/comps.test.ts` | 22 | $/sqft guard; median; sale age; included-only stats; unknown prices skipped (not $0); renovated vs unrenovated; summary fields; weight decay; hand-calculated comp weight; comp ARV ($187.50/sf × 1,400 = $262,500); exclusions with reasons; UNKNOWN ARV; Super comp % override (50% fixed → $180/sf × 1,400 = $252,000), multiple overrides, > 100% → UNKNOWN, scale-up when alone, ignored on non-Super / unused comps |
| `lib/comps-repo.test.ts` | 8 | validation (incl. unsafe links); tier/status defaults; % override validation (Super comps only, 0–100%); add/list/round-trip; audited edit/delete; cross-deal protection; import de-duplication |
| `lib/db.test.ts` | 2 | schema file splits cleanly into statements (no `;` in inline comments) |
| `lib/base-path.test.ts` | 3 | hidden-route basePath: empty/`/` → root, single segment accepted, anything else fails the build |

Worked example (`engine/fixtures.ts`; illustrative inputs, not market data):
$100k purchase · 3% closing · $40k rehab + 10% · 80% LTV IO @ 12%, 2 pts,
$1k fees, 6 months · $2.4k holding · $3k other → **All-in $159,800**. Base
ARV $200k → **equity $40,200**. Refi 75% → $150,000 loan, **$67,000
recovered of $79,800 (84%)**, cash left $12,800. Flip profit **$28,200**.
Max Offer @ 70% = (140,000 − 50,400) / 1.094 = **$81,901**.

## Screenshots / demo

All captured from the running production build during the E2E run.

| | |
|---|---|
| Dashboard (desktop) | [01-dashboard-desktop.png](docs/screenshots/01-dashboard-desktop.png) |
| New deal with live preview (insurance + lender min DSCR left UNKNOWN) | [02-new-deal-form-live-preview.png](docs/screenshots/02-new-deal-form-live-preview.png) |
| Full deal analysis: 89.8 score, but **PASS** because two hard gates fail | [03-deal-analysis-desktop.png](docs/screenshots/03-deal-analysis-desktop.png) |
| Audit trail: Purchase Price Old $125,000 → New $115,000, Changed by Guy | [04-audit-trail.png](docs/screenshots/04-audit-trail.png) |
| Export report / [sample PDF](docs/screenshots/05-export-sample.pdf) | [05-export-report.png](docs/screenshots/05-export-report.png) |
| Methodology | [06-methodology.png](docs/screenshots/06-methodology.png) |
| Mobile: dashboard, deal, form | [07](docs/screenshots/07-dashboard-mobile.png) · [08](docs/screenshots/08-deal-mobile.png) · [09](docs/screenshots/09-new-deal-mobile.png) |
| Comps page: stats, list, add form, deal summary comparison | [10-comps-page.png](docs/screenshots/10-comps-page.png) |
| Comp changes in the audit trail | [11-comps-audit.png](docs/screenshots/11-comps-audit.png) |
| Comps on mobile | [12-comps-mobile.png](docs/screenshots/12-comps-mobile.png) |
| Comp-supported ARV: weights, shares, Apply | [13-comp-arv.png](docs/screenshots/13-comp-arv.png) |

## ⚠️ Decisions that need Guy/Ben approval

The spec names these concepts but gives no number or rule. Each one is
isolated in `src/engine/config.ts` (marked `PROVISIONAL`) or documented as an
`INTERPRETATION`, and shown on /methodology. **None is final until
approved.**

1. **Capital Efficiency below 90%.** Currently linear (45% recycled = 12.5 pts).
2. **Cash Flow score.** Currently DSCR / 1.25 × 20 only. Monthly cash flow and
   CoC are not yet weighted.
3. **Risk / Stress (15 pts).** Currently 5 factors × 3 pts:
   - Equity at conservative ARV > 0.
   - Combined-stress DSCR ≥ lender minimum.
   - Combined-stress flip profit > 0.
   - Complexity: Light 3 / Medium 2 / Heavy 1 / Major 0.
   - ARV confidence: High 3 / Medium 1.5 / Low 0.
4. **What counts as a "viable exit."**
   - BRRRR: post-refi cash flow > 0 and DSCR ≥ lender minimum.
   - Hold: cash flow on acquisition financing > 0.
   - Flip: profit > 0.
   - Hybrid: a rental exit and Flip are both viable.
5. **"Hold" means keeping the acquisition financing (no refi).** If you meant
   something else (e.g. a separate long-term loan input), that is a new input.
6. **Best use of capital.** Currently the highest annual return on capital
   left in: BRRRR CoC, Hold CoC, or Flip ROI × 12 / months.
7. **DSCR hard-gate minimum.** Entered per deal as a lender term (no default).
   While blank, the gate is UNKNOWN and the deal cannot be a BUY.
8. **Incomplete underwriting.**
   - Any UNKNOWN input or gate blocks BUY → INVESTIGATE.
   - It becomes PASS if the score can't reach 65 even with every unknown
     resolved favourably.
9. **Spec conflict to confirm.** §25 "Negative post-refi cash flow → automatic
   PASS" applies even to deals whose best exit is a flip (see the
   `[DEMO] 7 Flip Only Ln` deal: $53k flip profit, PASS). That is
   implemented literally. Should this gate apply only when BRRRR/Hold is the
   intended strategy?
10. **Comp-ARV weighting numbers.** The method and criteria are approved;
    these numbers are placeholders:
    - Tiers: Standard 1× / Best fit 2× / Super comp 3×.
    - Each factor runs from 1 down to a 0.25 floor: recency floors at 12
      months, distance at 2 mi, sqft at a 30% size difference, beds and
      baths at 2 apart.
    - Status: Sold 1 / Pending 0.75 / Active 0.5.
    - An unknown comp fact scores at the floor.
11. **Smaller interpretations.**
    - Closing $ is used only when Closing % is blank.
    - Inspection, attorney, title and other acquisition costs go into "Other
      Project Costs."
    - Refi is sized on Base ARV and fully amortizing.
    - Max Offer recomputes price-linked costs at the offer price.
    - Score is rounded to 0.1 before classification.

## Comparable properties (§32)

Deal page → **Manage comps** (`/deals/[id]/comps`):

- **Add / edit / delete comps by hand**: address, sale price, sale date,
  sqft, beds, baths, distance, condition, renovated/unrenovated, source and
  link, and notes. $/sqft and sale age are computed. Blank fields stay
  UNKNOWN and are skipped by each statistic.
- **Exclude** an outlier to keep it on file but out of the stats.
- **Statistics** are shown for renovated, unrenovated and all included
  comps: count, median and average price, range, median and average $/sqft,
  distance, and sale age.
- **Apply to deal.** The deal's §8 comp summary fields sit next to the
  list's values (mismatches highlighted). One click copies them over, and
  every field change is audited. Distance = farthest comp; recency = oldest
  sale.
- **Comp-supported ARV** (approved method):
  - Weighted average $/sqft of the included **renovated** comps × the
    subject's sqft.
  - Each comp's weight comes from time, distance and similarity (sqft,
    beds, baths, status), multiplied by its tier: Standard / **Best fit** /
    **Super comp**.
  - **% override (Super comps only):** give a Super comp a fixed share of
    the ARV, e.g. 50%. That replaces its computed weight, and the remaining %
    is split among the other comps by weight.
    - Overrides must total 100% or less; above that, the comp ARV shows
      UNKNOWN with an explanation.
    - If no other comp can take the remainder, the overrides are scaled up
      to 100%, and the page says so.
    - An override on a comp that isn't used (e.g. not renovated) is ignored
      and reported.
  - The page shows each comp's factors and its % share of the ARV ("fixed"
    marks an override), plus an unweighted median cross-check.
  - It's a **suggestion**: Base ARV changes only when you click "Apply"
    (audited). Conservative and Upside stay manual.
- **"Why?" panel.** It notes when your Base ARV is above the comp-supported
  ARV (with the % gap) or at/below it.
- Every comp change goes to the audit trail with before/after values, and
  comps appear in the PDF export.

**Automation (next step).** Implement `CompProvider.search()` for the chosen
source and pass its results to `compsRepo.importComps()`. Imported comps then
go through the same validation as manual entry, are stored with
`origin = 'import'`, and are de-duplicated by `external_id` on re-import.

## Known limitations

- **Auth.** There is no login, only a Guy/Ben selector (per §2) plus one
  shared Basic Auth password for the whole app. It fails closed: a
  production server without the password configured refuses every request
  (503). Both users share that
  password, so the audit trail relies on each person picking their own name.
- **PDF export.** The PDF comes from the browser's print dialog
  ("Save as PDF"), not server-side generation.
- **Comps are manual for now.** Automated import is wired at the code level
  (`importComps()` + `CompProvider`) but no data source is connected yet.
  Other data integrations and the listing parser (§30) are not built.
- **Comps don't score directly.** Comps affect the score only through the
  Base ARV, and only after you apply the comp ARV. Flagging a weak comp set
  (e.g. too few or too old comps) would be a new rule needing approval.
- **Deleting deals.** There is no delete; use the `Archived` status.
- **Rehab duration** is captured but not used in calculations: interest
  runs on **project months** (purchase → refi or sale), which is a separate
  input.
- **Expense periods.** Taxes, insurance, HOA, utilities and other OpEx are
  entered **annually** and rents **monthly**, as labelled in the form.
- **Prepayment penalty** is stored as reference text and is not modeled.
- **Seasoning** produces a warning when project months < requirement; it
  does not block the refi.
- **Dashboard scale.** The dashboard computes analysis per deal on each
  request. That's fine for hundreds of deals; for many thousands, cache
  summaries.
- **PGlite** is for local, single-process use. Deployed instances must set
  `DATABASE_URL` (Supabase/Postgres).

## Deploying: hidden route on the investor website

For testing, the analyzer is exposed at a hidden path on the website
(`yoursite.com/vf-internal`). It's still a separate app and deployment; the
website only forwards that path to it. Moving it to its own repo later means
removing the forward.

```
browser → yoursite.com/vf-internal/* ──(site rewrite, Vercel)──▶ Railway: deal-analyzer /vf-internal/*
                                                                   └ Basic Auth (middleware) → app → Railway Postgres
```

**Current setup (Railway project `valeforge-deal-analyzer`, workspace "Guy Kuperly's Projects"):**

| Service | What | Settings |
|---|---|---|
| `Postgres` | Railway PostgreSQL template | Password generated by Railway |
| `deal-analyzer` | This folder: repo `kuperly/investor-site`, branch `ccr-8ff946f6-4opti8`, root `/deal-analyzer`; redeploys on push | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ANALYZER_BASE_PATH=/vf-internal`, `BASIC_AUTH_USER=valeforge`, `NODE_ENV=production`, `BASIC_AUTH_PASSWORD=${{Postgres.BASIC_AUTH_PASSWORD}}` (a reference: the secret value was entered by Guy/Ben on the `Postgres` service. To change the password, edit it there, or replace the reference with a value on `deal-analyzer`) |

Public origin: `https://deal-analyzer-production.up.railway.app` (the app
lives under `/vf-internal`). If `BASIC_AUTH_PASSWORD` is ever missing (e.g.
the referenced value is deleted), every request returns 503 (fail-closed).
Verified on Oct 5, 2026: no password / wrong password → 401 on every path; the
bypass header and server-action POSTs → 401. The website's preview
deployments sit behind Vercel Authentication as well. The schema is applied automatically on the
first request.

**Website (Vercel project `investor-site`) environment variables:**
- `ANALYZER_URL=https://deal-analyzer-production.up.railway.app`
- `ANALYZER_BASE_PATH=/vf-internal`

Add them for **Preview** first (scoped to this branch), then redeploy the
preview. The rewrite is inert while either variable is missing. For the
production site (`investor-site-wheat.vercel.app`), add the same two
variables for **Production** after the branch is merged into `main`.

**After the branch merges**, switch the Railway service's branch to `main`.

**Verify** in a private window: `…/vf-internal` must ask for the password
before showing anything. `npm run e2e:auth` checks the same locally.

"Hidden" only means unlinked and not indexed (`noindex` meta +
`X-Robots-Tag`). The password is what protects the data.
