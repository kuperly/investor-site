# ValeForge — Deal Analyzer + Market Intelligence (VF-03)

One internal app, two separate modules with one login:

- **Deal Analyzer**: property-level underwriting (this section, spec [docs/SPEC.md](docs/SPEC.md)).
- **Market Intelligence (VF-03)**: where to search, for which opportunities, with which
  strategy (see [Market Intelligence](#market-intelligence-vf-03), spec
  [docs/VF03-SPEC.md](docs/VF03-SPEC.md), status and gap analysis
  [docs/VF03-ALIGNMENT.md](docs/VF03-ALIGNMENT.md)).

They connect only through a contract: a VF-03 candidate is handed to the Deal Analyzer as a
new deal (`DealInputs`), market capital efficiency is computed by the Deal Analyzer engine
itself, and actual results flow back. `src/market/boundary.test.ts` enforces the separation.

## Deal Analyzer

Internal underwriting engine for ValeForge. Enter a property and it evaluates
the deal as **BRRRR, Hold, Flip and Hybrid** in parallel (*the deal chooses the
strategy*). It returns All-in, Equity, Max Offer, Refi, DSCR, Cash Flow, Flip
profit, stress tests, a 100-point **ValeForge Deal Score** and a
**BUY / INVESTIGATE / PASS** recommendation. Hard gates always override the
score.

Full specification: [docs/SPEC.md](docs/SPEC.md). Every rule the engine
applies, with its source (SPEC / APPROVED / PROVISIONAL / INTERPRETATION), is
listed on the in-app **/methodology** page. How the app maps to every section
of the spec, including gaps and approved changes:
[docs/SPEC-ALIGNMENT.md](docs/SPEC-ALIGNMENT.md).

> This app lives in `deal-analyzer/` inside the `investor-site` repo, but it is
> a fully separate Next.js project with its own `package.json`. The marketing
> site's build, tests and Vercel deployment ignore this folder.

---

## Run locally

```bash
cd deal-analyzer
npm install
npm run db:seed     # optional: [DEMO] deals and 6 [DEMO] markets (synthetic numbers, not market data)
ADMIN_USERNAME=guy ADMIN_PASSWORD='choose-12+-chars' ADMIN_DISPLAY_NAME=Guy npm run dev   # http://localhost:3100
```

Sign in at `/login` with that username and password: the first admin is created on the first
sign-in while there are no users. Add the others on **Users** (`/admin/users`). In
development a built-in session secret is used; production requires `SESSION_SECRET`.

No database setup is needed: with no `DATABASE_URL`, the app uses **PGlite**
(real PostgreSQL compiled to WASM), stored in `./.data/pglite`. Pending migrations
(`db/migrations/`) are applied automatically on first use.

To use PostgreSQL / Supabase instead:

```bash
cp .env.example .env.local      # set DATABASE_URL=postgres://…
npm run db:migrate              # applies pending versioned migrations
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
| `npm run e2e` | Isolated DB → seed → production build → Playwright suites (`e2e/`: deals, comps, markets), signing in for real |
| `npm run e2e:auth` | Builds at `/` and at `/vf-internal`, then checks every kind of path requires a session; fail-closed without `SESSION_SECRET`; browser sign-in and revocation |

### Users and sign-in

- Everyone has an account (`users`: username, display name, role, scrypt password hash).
  The display name is what audit trails record. Roles: **admin** (manage users, change
  VF-03 scoring thresholds) and **member** (everything else).
- Sessions are an HMAC-signed, httpOnly cookie (7 days). Every page and action re-checks
  that the account is still active and the session wasn't revoked; a password change,
  deactivation or "Sign out on every device" ends all sessions. Five failed sign-ins lock
  that username / address for 15 minutes.
- Environment: `SESSION_SECRET` (32+ characters, required in production, else every
  request gets 503), `ADMIN_USERNAME` / `ADMIN_PASSWORD` (+ optional `ADMIN_DISPLAY_NAME`)
  to create the first admin. `AUTH_DISABLED=1` is open-access mode: no login, changes are
  recorded as "Open access (login off)", no admin pages. Use only by the owner's decision.

---

## Architecture

```
src/
  engine/            ← ALL business logic. Pure TypeScript: no React, no I/O.
    types.ts           DealInputs (every numeric input is number | null; null = UNKNOWN)
    config.ts          every threshold, tagged SPEC / APPROVED / PROVISIONAL, plus the methodology table
    fields.ts          field registry (label, kind, section): drives the form, parser and warnings
    finance.ts         amortization schedule, payment, remaining balance, interest-only
    formulas.ts        §10–§21 as one small pure function each, with guarded division
    underwrite.ts      composes formulas over nullable inputs → CoreResult (+ per-result `inc`
                       "incomplete" lists); Max Offer solver
    stress.ts          §22 scenarios
    comps.ts           §32 comp statistics (renovated / unrenovated / all, $/sqft, distance, sale age)
    strategies.ts      §26 BRRRR / Hold / Flip / Hybrid + best use of capital
    gates.ts           §25 hard gates (computed + checklist)
    score.ts           §23 point functions
    recommendation.ts  §24 BUY / INVESTIGATE / PASS
    analyze.ts         analyzeDeal(inputs) → full DealAnalysis, including "Why?" text
    fields.ts          (also) DEFAULTABLE_KEYS + applyDefaults(): which inputs may carry a ValeForge default
  lib/               ← infrastructure (no business rules)
    db.ts              driver-agnostic Db: postgres.js (DATABASE_URL) or PGlite; transaction()
    migrations.ts      versioned migrations runner (checksums, advisory lock, one transaction)
    auth/              password (scrypt), token (signed session), throttle, bootstrap admin, safe-next
    session.ts         currentUser / requireUser / requireAdmin; users.ts, users-repo.ts
    deals-repo.ts      CRUD + per-field audit rows in one transaction, optimistic locking (version)
    deal-snapshots.ts  stored analysis snapshots (engine version) on every save
    settings-repo.ts   ValeForge default assumptions + change history
    comp-summary.ts    keeps the deal's §8 comp summary in sync with its comps list
    comps-repo.ts      §32 comps: manual add/edit/delete + importComps() for automation, all audited
    comps/parse-comp.ts  one validator for manual entry AND imports (blank → UNKNOWN, http(s) links only)
    comps/provider.ts  CompProvider interface — where an automated data source plugs in
    audit.ts           diff of inputs / notes / status
    parse-inputs.ts    FormData → DealInputs (blank → null, % → decimal, type/range checks only)
    format.ts          display helpers ("UNKNOWN", "∞ (no cash left)", "N/A (no debt)")
  market/            ← VF-03 Market Intelligence (see below)
  app/               ← Next.js 15 App Router UI (server components + server actions)
    login/                   sign-in (public)
    (app)/page.tsx           Deal Dashboard (filters, desktop table / mobile cards)
    (app)/deals/new, deals/[id], deals/[id]/edit, deals/[id]/comps, deals/[id]/export,
    (app)/settings (default assumptions), methodology, account, admin/users
    (app)/markets/…          VF-03 screens
    actions.ts · comps-actions.ts · settings-actions.ts · auth-actions.ts · market-actions.ts
  components/        AnalysisView (shared by deal page + export), DealForm (live preview), …
  middleware.ts      sign-in gate for every path (no matcher, on purpose)
db/migrations/       0001 baseline (the V1 schema) · 0002 users · 0003 deal integrity · 0004 market intelligence
```

Design points:

- **One engine, three consumers.** The deal page, the dashboard and the PDF
  export all call `analyzeDeal()`. The form's live preview runs the same
  function in the browser. Nothing computes a financial number outside
  `src/engine`.
- **Analysis is computed live, and also snapshotted.** Every view recomputes
  from the inputs, so a rule change applies to all deals immediately. Each
  save also stores a snapshot of what the engine said then (with
  `ENGINE_VERSION`), shown under "Analysis history": later rule changes
  never rewrite history, and actual results can be compared with what was
  predicted.
- **Saves are transactional and locked.** The deal row, its audit rows and
  the snapshot commit together. A form opened at an older version can't
  overwrite someone else's save ("This deal was changed by … after you
  opened it").
- **Calculate with what's known (§29, approved).**
  - **Core drivers** (purchase price, rehab, ARV, rent, refi LTV/rate/term)
    are strict: if one is missing, results that need it show UNKNOWN.
  - **Line items** (closing %, fees, holding, expenses, selling %…) that are
    missing show UNKNOWN, never $0. They are left out of the totals they feed,
    and every such total is marked `*` with the list of missing inputs
    (`CoreResult.inc`).
  - The spec warning is still shown: *"Underwriting incomplete — insurance
    estimate required."*
  - Partial totals are optimistic, so a hard gate, exit or risk factor that
    fails on them is a proven fail; one that passes stays UNKNOWN. BUY is
    impossible while anything is missing.
- **Ready for integrations (§30).** A future Zillow/rent/tax importer only has
  to produce a partial `DealInputs`; the engine doesn't change. ARV and rehab
  are never auto-filled.

## Database schema

Versioned migrations in `db/migrations/` (see "Database gotchas" in CLAUDE.md). Deal Analyzer tables:

| Table | Columns |
|---|---|
| `deals` | `id uuid pk`, `address`, `city`, `state`, `zip`, `market`, `status` (CHECK: the 9 spec statuses), `inputs jsonb` (all `DealInputs`; unknown = JSON `null`), `notes jsonb` (§31 categories), `defaulted jsonb` (input keys still holding an unconfirmed ValeForge default), `version` (optimistic lock), `source_candidate_id → candidates` (VF-03 hand-off), `created_by`, `updated_by`, `created_at`, `updated_at` |
| `deal_audit` | `id`, `deal_id → deals`, `field`, `old_value jsonb`, `new_value jsonb`, `changed_by`, `changed_at` (comp changes use `field = 'comps'`, actual results `field = 'outcome'`) |
| `deal_analysis_snapshots` | `id`, `deal_id`, `deal_version`, `engine_version`, `inputs`, `comp_arv`, `result` (summary), `full_result` (analyzeDeal output), `created_by`, `created_at` |
| `deal_outcomes` | actual result per deal (purchase, ARV, rehab, rent, timeline, exit, profit, cash flow, refi loan, capital recovered) + candidate / geography / avatar / predicted snapshot, `version`, recorded by/at |
| `settings` | `key` (`deal_defaults`), `value jsonb` (the default assumptions), `updated_by`, `updated_at` |
| `settings_history` | `id`, `key`, `field`, `old_value`, `new_value`, `changed_by`, `changed_at` (one row per changed default) |
| `deal_comps` | `id`, `deal_id → deals` (cascade), `address`, `sale_price`, `sale_date`, `sqft`, `beds`, `baths`, `distance_miles`, `condition`, `renovation` (`renovated` / `unrenovated` / null = unknown), `sale_status` (`sold` / `pending` / `active` / null), `tier` (`standard` / `bestFit` / `superComp`), `share_override` (fraction 0–1, Super comps only, null = computed weight), `source`, `source_url`, `notes`, `included`, `origin` (`manual` / `import`), `external_id` (unique per deal + source, so re-imports never duplicate), created/updated by/at |
| `users` / `user_audit` | accounts (username, display name, role, password hash, active, session_version) and who changed which account |
| `schema_migrations` | version, name, checksum, applied_at |

VF-03 tables are listed under [Market Intelligence](#market-intelligence-vf-03).

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
  - A live sidebar shows score, recommendation and key numbers as you type,
    and each section shows what it calculates (closing $, contingency, loan,
    interest, refi loan, NOI, DSCR, flip profit, Max Offer…). Closing $ is
    calculated from Closing %.
  - Results appear as soon as the basics are entered (Purchase, Rehab, ARV,
    Rent). Missing items show UNKNOWN, and the totals they feed are marked `*`.
  - The comp summary fields are read-only, calculated from the comps list.
- **Default assumptions** (`/settings`, nav "Defaults"):
  - Guy/Ben set ValeForge's standard numbers once. These are assumption
    fields only (closing %, fees, loan/refi terms, vacancy, management,
    maintenance, CapEx, selling %…), never property facts.
  - New deals start pre-filled, each value marked **Default** until confirmed
    or changed. "Confirm all defaults" and "Fill blanks from defaults" are on
    the form, and the deal page lists unconfirmed defaults.
  - Every change to the defaults is recorded with who and when.
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
- Accounts and sign-in, admin user management, account page (change password,
  sign out everywhere).
- Analysis history (stored snapshots) and an "Actual result" form on every deal
  (feedback loop); deals created from a VF-03 candidate link back to their market.

## Acceptance criteria → evidence

| AC | Covered by |
|---|---|
| AC1 create deal · AC2 inputs · AC15 saved · AC16 reopen & edit | E2E run (Playwright) on PGlite and on PostgreSQL 16; `deals-repo.test.ts`. With only Purchase / Rehab / ARV / Rent entered, All-in, equity, NOI, flip and Max Offer calculate (`analyze.test.ts` AC2 + E2E) |
| AC3 All-in · AC4 Equity | `underwrite.test.ts` hand-calculated example ($159,800 / $40,200) |
| AC5 Max Offer | hand calculation, plus an exact check that All-in at the Max Offer = ARV × 70% for IO, amortizing, closing-$ and all-cash loans |
| AC6 BRRRR · AC7 Refi · AC8 DSCR · AC9 Cash Flow | `underwrite.test.ts`, `formulas.test.ts` (incl. the spec's $60K / $54K = 90%) |
| AC10 Flip | `formulas.test.ts`, `underwrite.test.ts` |
| AC11 Stress | `analyze.test.ts`: the five scenarios and their directional effects |
| AC12 Score · AC14 Recommendation | `score.test.ts`, `recommendation.test.ts` (80 / 79.9 / 65 / 64.9 boundaries) |
| AC13 Hard gates | `analyze.test.ts`: checklist yes, DSCR < min, negative CF and no exit each force PASS on a 90-point deal |
| AC17 no ÷0 | `safeDivide`, CoC → ∞; a test walks every output with zero ARV / rent / rates / price and asserts no NaN or Infinity |
| AC18 UNKNOWN ≠ $0 | parser, engine, UI and E2E tests. Missing insurance → the insurance line shows UNKNOWN, the spec warning appears, and DSCR is marked `*` (calculated without it). A property test checks every line item: blanking it never changes a result without flagging it |
| AC19 testable formulas | every formula is an exported pure function in `src/engine` |
| AC20 mobile + desktop | E2E asserts no horizontal scroll at 390 px on dashboard, deal and form; screenshots below |

## Formula / unit tests

`npm test`: **282 tests, 20 files**, all passing (also against real PostgreSQL 16 via `TEST_DATABASE_URL`). `npm run e2e` adds 91 browser checks (deals, comps, markets); `npm run e2e:auth` adds 69 sign-in checks across `/` and basePath builds, fail-closed and open-access mode.

| File | Tests | Covers |
|---|---|---|
| `engine/finance.test.ts` | 11 | $150k @ 7% / 30y = $997.95; 0% rate; schedule pays to 0; interest + principal = payments; IO interest |
| `engine/formulas.test.ts` | 34 | every §10–§21 formula; ÷0 guards; Cash Left floor and released cash; CoC ∞ |
| `engine/underwrite.test.ts` | 22 | full worked example; amortizing acquisition; all-cash; released equity; Max Offer exactness (×4 financing modes); missing line items → UNKNOWN line + partial, flagged totals; core drivers strict; unknown LTV; no NaN/∞ |
| `engine/score.test.ts` | 10 | each component's scaling and clamps; risk factor unknowns; partial pass → UNKNOWN, partial fail → 0; total / max achievable |
| `engine/recommendation.test.ts` | 12 | threshold boundaries; gate FAIL overrides; UNKNOWN blocks BUY; "can't reach 65" → PASS |
| `engine/analyze.test.ts` | 55 | end-to-end BUY deal; strategies; Max Offer ×3; stress; every computed gate; spec warning text; empty deal; Base-vs-comp-ARV "Why?" text; AC2 basics-only deal; partial fail proven / partial pass not; **property test over every line item** (blanking it never changes a result unflagged) |
| `engine/defaults.test.ts` | 4 | defaults fill blanks only; an explicit 0 is kept; property facts can't be defaulted |
| `lib/settings-repo.test.ts` | 3 | save + change history; form parsing; deals remember unconfirmed defaults |
| `lib/parse-inputs.test.ts` | 6 | blank → null; explicit 0 kept; `$125,000` and `7.5%` parsing; validation; round-trip |
| `lib/deals-repo.test.ts` | 9 | create/read; audit Old $125,000 → New $115,000 by Ben; no-op saves; filters; real `jsonb` storage; optimistic locking (stale save refused, nothing written); a failure rolls back the change and its audit rows; analysis snapshots keep what was predicted |
| `engine/comps.test.ts` | 22 | $/sqft guard; median; sale age; included-only stats; unknown prices skipped (not $0); renovated vs unrenovated; summary fields; weight decay; hand-calculated comp weight; comp ARV ($187.50/sf × 1,400 = $262,500); exclusions with reasons; UNKNOWN ARV; Super comp % override (50% fixed → $180/sf × 1,400 = $252,000), multiple overrides, > 100% → UNKNOWN, scale-up when alone, ignored on non-Super / unused comps |
| `lib/comps-repo.test.ts` | 9 | validation (incl. unsafe links); tier/status defaults; % override validation (Super comps only, 0–100%); add/list/round-trip; audited edit/delete; cross-deal protection; import de-duplication; comp summary auto-sync (audited, no-op when in sync) |
| `lib/db.test.ts` | 14 | every migration splits cleanly (no `;` in inline comments, `$$` bodies kept); versions 1..n; applied once with checksums; an edited applied migration or an older build is refused; transactions roll back |
| `lib/auth/auth.test.ts` | 13 | scrypt hashing; 12+ character passwords; signed session tokens (tampering, wrong secret, expiry); production requires `SESSION_SECRET`; sign-in throttle; safe post-sign-in redirect |
| `lib/users-repo.test.ts` | 4 | first admin from env only while there are no users; authenticate; password change ends sessions; deactivation; audit without secrets; at least one active admin; unique names |
| `market/engine/engine.test.ts` | 33 | VF-03 engine, hand-calculated: percentiles, partial roll-ups and bounds, risk bands, freshness policies, ACS margin of error → confidence, derived metrics, capital efficiency = ratios of `analyzeDeal` outputs, decisions (DRILL_DOWN / KEEP / DROP / WATCH), BLOCK, no false-precision ranking, thin peers, stale data, Strategy Fit roll-up, rent-by-room gate, change explanation, avatar fit, opportunity universe, hand-off contract, observation validation, configuration overrides |
| `market/ingest/providers.test.ts` | 8 | Census ACS, HUD FMR/SAFMR, BLS LAUS, FRED parsers against recorded responses; keys redacted; missing release → growth UNKNOWN |
| `market/lib/market.test.ts` | 7 | geography hierarchy; ingestion validation / duplicates / append-only; missing key; manual evidence needs a source; conditional drill-down + snapshots + change; capital efficiency from samples; hand-off + feedback loop |
| `market/boundary.test.ts` | 3 | Deal Analyzer engine never imports VF-03; VF-03 uses only the DealInputs contract and analyzeDeal(); VF-03 engine is pure |
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
| Only Purchase / Rehab / ARV / Rent entered: results calculate, marked `*` | [14-basics-only-live.png](docs/screenshots/14-basics-only-live.png) |
| New deal pre-filled from ValeForge defaults (Default badges) | [15-new-deal-defaults.png](docs/screenshots/15-new-deal-defaults.png) |
| Users (admin) | [16-admin-users.png](docs/screenshots/16-admin-users.png) |
| VF-03 market list ([DEMO] markets) | [17-markets-list.png](docs/screenshots/17-markets-list.png) |
| VF-03 market detail: decision, dimensions, strategy matrix, risk, universe, drill-down, evidence | [18-market-detail.png](docs/screenshots/18-market-detail.png) |
| VF-03 candidates | [19-candidates.png](docs/screenshots/19-candidates.png) |
| Deal created from a candidate, with the actual-result form | [20-deal-from-candidate.png](docs/screenshots/20-deal-from-candidate.png) |
| VF-03 data sources | [21-data-sources.png](docs/screenshots/21-data-sources.png) |
| VF-03 markets on mobile | [22-markets-mobile.png](docs/screenshots/22-markets-mobile.png) |

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
   - (Approved: missing line items are left out of totals and flagged. The
     remaining interpretation needing a check: if the acquisition loan terms
     are missing, the payoff at refi is taken as the full loan principal.)
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
- **Comp summary, automatic.** The deal's §8 comp summary fields (number of
  comps, average/median price, distance, recency, renovated/unrenovated
  counts) are calculated from the list. They update on every comp change and
  deal save, each change audited. Distance = farthest comp; recency = oldest
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

## Market Intelligence (VF-03)

Where should ValeForge search, for which opportunities, with which strategy?
Built to [docs/VF03-SPEC.md](docs/VF03-SPEC.md); section-by-section status,
the V1 gap analysis, conflicts and open decisions:
[docs/VF03-ALIGNMENT.md](docs/VF03-ALIGNMENT.md). Every rule and its
provenance: `/markets/methodology`.

**Layers kept separate (§18):** Market ("this geography is attractive") →
Opportunity Universe ("many properties match our thesis") → Candidate ("this
property deserves underwriting") → Deal Analyzer ("BUY / INVESTIGATE / PASS")
→ Actual result.

**How a market is scored**
- Seven independent dimensions: Market Quality, Opportunity Density, Capital
  Efficiency, Strategy Fit, Risk, Confidence, Freshness.
- Every metric becomes a 0–100 **percentile among peers** (MSAs vs MSAs; ZIPs
  vs the other ZIPs of the same market). Raw values are kept and shown.
- Core Market Priority = Quality × 25% + Opportunity × 30% + Capital × 25% +
  Strategy × 20%, × the **risk modifier** (Low 1.00 · Moderate 0.95 ·
  Elevated 0.85 · High 0.70 · Critical = BLOCK).
- **UNKNOWN is never 0.** Each score has a point (known parts), bounds (unknowns
  at 0 / 100) and completeness. Missing data lowers confidence, not
  attractiveness. With low confidence, low completeness or fewer than 5 peers
  the score is shown as a range (or ≈) and the market is **not ranked**.
- **Capital Efficiency** reuses the Deal Analyzer: link a deal (or freeze a
  copy) as a sample for a geography; VF-03 takes the median of ratios of
  `analyzeDeal()`'s own outputs. No underwriting formula exists in VF-03.
- **Strategy Fit** scores 9 strategies separately (BRRRR, Buy & Hold, Fix &
  Flip, Section 8 / HCV, Rent by Room, Small Multifamily, Off-Market, Creative
  Finance, Mid-Term Rental); Section 8 and Rent by Room are overlays. The
  roll-up rewards several strong strategies (best 50% · 2nd 30% · 3rd 20%).
- **Risk**: 11 factors shown separately, material risks called out, hard risk
  flags (critical blocks regardless of score).
- **Decision**: KEEP / WATCH / DROP / DRILL DOWN (never BUY/PASS), with the
  reasons listed. Thresholds are admin-configurable and every change is recorded.
- **Conditional drill-down**: submarkets and ZIPs are added and analyzed only
  under a promoted parent; the promotion stores why it qualified.
- **Snapshots and change detection**: every "Evaluate now" stores a snapshot;
  the page explains a change in priority points per dimension and component,
  plus the risk-modifier effect.
- **Avatars** (defined by Guy/Ben, none built in) → avatar fit and estimated
  matching units from ACS distributions (labelled estimates).
- **Candidates → Deal Analyzer**: "Send to Deal Analyzer" creates a deal with
  the property facts and asking price, in one transaction. ARV / rehab / rent
  estimates go to the deal notes, not applied. The deal links back, and its
  actual result is recorded on the deal page (feedback loop).

**Data (V1: official / primary only, §14).** Census ACS 5-year (current release +
the one five years earlier, with margins of error), HUD FMR / Small Area FMR,
BLS LAUS metro, FRED (Realtor.com listings — labelled commercial — and the
FHFA HPI). Plus local evidence entered by hand with a **required source** and an
evidence level (official → anecdotal). No MLS, Zillow scraping, PropStream or
paid data. Each run stores its raw payloads; each value is validated and stored
append-only (a database trigger blocks updates); rejected values are kept with
their reasons and never scored. The providers need free API keys (see
Deploying). Their parsers are tested against recorded responses; Census variable
codes were verified against the official metadata; HUD / BLS / FRED have not
been called live from the build environment yet.

**Code map**
```
src/market/
  engine/      pure TS (no I/O): types · metrics (catalogue) · config (weights, thresholds, methodology)
               freshness · derive (raw → evidence) · capital (via analyzeDeal) · evaluate (single entry point)
               change · avatar · universe · handoff · validate · fixtures (synthetic test data)
  ingest/      types (provider contract) · pipeline · registry · providers/{census-acs, hud-fmr, bls-laus, fred}
  lib/         repo (all VF-03 tables) · service (evaluate + snapshot, drill-down, hand-off)
  ui/          panels, badges, formatting
src/app/(app)/markets/   list · [geoId] · avatars · candidates · ingestion (Data) · methodology
```

**Tables (migration 0004):** `geographies` (official-code keys, parent),
`market_observations` (append-only evidence with provenance + validation),
`ingestion_runs` + `ingestion_raw`, `market_hard_flags`, `market_deal_samples`,
`market_config` (threshold overrides), `market_snapshots`, `geo_promotions`,
`avatars`, `candidates`, `market_audit` (every VF-03 change), plus
`deals.source_candidate_id` and `deal_outcomes` on the Deal Analyzer side.

**Try it locally:** `npm run db:seed` creates six `[DEMO]` markets (synthetic
evidence, codes 99901–99906 — not real CBSAs). Sign in → Market Intelligence →
**Evaluate now** → open a market → **Promote for drill-down** → add a ZIP →
add an avatar and a candidate → **Send to Deal Analyzer**.

### VF-03 decisions that need Guy/Ben approval

Listed with their current values in [docs/VF03-ALIGNMENT.md](docs/VF03-ALIGNMENT.md)
§3 (M1–M10): initial weights, component-internal weights, Strategy Fit
roll-up, risk bands, confidence scores, the precision rule, decision and
drill-down thresholds, metric directions, freshness policies and the avatar
independence assumption.

## Known limitations

- **Sign-in throttle** is in memory (one app instance); it resets on restart.
- **Static assets** (`/_next/static`) are public so the sign-in page can load;
  they hold client code only, never data.
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
- **Analysis snapshots start with this release.** Deals saved before it have
  no history until their next save.
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
                                                                   └ sign-in (middleware + session) → app → Railway Postgres
```

**Current setup (Railway project `valeforge-deal-analyzer`, workspace "Guy Kuperly's Projects"):**

| Service | What | Settings |
|---|---|---|
| `Postgres` | Railway PostgreSQL template | Password generated by Railway |
| `deal-analyzer` | This folder: repo `kuperly/investor-site`, branch `ccr-8ff946f6-4opti8`, root `/deal-analyzer`; redeploys on push | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ANALYZER_BASE_PATH=/vf-internal`, `NODE_ENV=production`, `SESSION_SECRET` (random, set on the service), and **currently `AUTH_DISABLED=1`** (see below). Optional data keys: `CENSUS_API_KEY`, `HUD_API_TOKEN`, `BLS_API_KEY`, `FRED_API_KEY` |

Public origin: `https://deal-analyzer-production.up.railway.app` (the app
lives under `/vf-internal`). Pending migrations run automatically on the first
request after each deploy.

> ⚠️ **Login is currently OFF** (Guy's request, Oct 5 2026, for open
> testing): `AUTH_DISABLED=1`. Anyone with the URL can read and edit, and
> changes are recorded as "Open access (login off)".
> **To turn real sign-in on:** in Railway → `deal-analyzer` → Variables:
> 1. set `ADMIN_USERNAME` (e.g. `guy`), `ADMIN_PASSWORD` (12+ characters,
>    typed by you, never shared in chat) and `ADMIN_DISPLAY_NAME` (e.g. `Guy`);
> 2. delete `AUTH_DISABLED`.
>
> After the redeploy, sign in at `/vf-internal/login` with that username and
> password, then add Ben on **Users**. Check in a private window that
> `/vf-internal` sends you to the sign-in page. If `SESSION_SECRET` is ever
> missing, every request returns 503 (fail-closed). The old
> `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` variables are no longer used.

**Market data keys (free).** Each data source shows "Not configured" on
`/markets/ingestion` until its key is set on the `deal-analyzer` service:
`CENSUS_API_KEY` (api.census.gov/data/key_signup.html), `HUD_API_TOKEN`
(huduser.gov/hudapi/public/register), `FRED_API_KEY`
(fredaccount.stlouisfed.org/apikeys); `BLS_API_KEY` is optional but strongly
recommended (data.bls.gov/registrationEngine).

**Website (Vercel project `investor-site`) environment variables:**
- `ANALYZER_URL=https://deal-analyzer-production.up.railway.app`
- `ANALYZER_BASE_PATH=/vf-internal`

Add them for **Preview** first (scoped to this branch), then redeploy the
preview. The rewrite is inert while either variable is missing. For the
production site (`investor-site-wheat.vercel.app`), add the same two
variables for **Production** after the branch is merged into `main`.

**After the branch merges**, switch the Railway service's branch to `main`.

**Verify** in a private window: `…/vf-internal` must redirect to the sign-in
page before showing anything. `npm run e2e:auth` checks the same locally.

"Hidden" only means unlinked and not indexed (`noindex` meta +
`X-Robots-Tag`). Sign-in is what protects the data.
