# ValeForge: Market Intelligence → Deal Sourcing → Deal Analyzer — CLAUDE.md

Internal app for ValeForge (US real-estate investing). Users: Guy and Ben, each
with their own account. Three **separate modules, one deployment, one login**,
working as **one chain of layers** ([docs/LAYERS.md](docs/LAYERS.md)):

- **Market Intelligence, VF-03** (layers 1–2; `src/market`, `/markets/*`): where to
  search. See "VF-03 rules" below.
- **Deal Sourcing** (layers 3–4; `src/sourcing`, `/sourcing/*`): sourcing targets
  (area × buy box) and leads, screened against the buy box. See "Layer rules".
- **Deal Analyzer** (layers 5–6; `src/engine`, `src/lib`, `/`, `/deals/*`):
  property-level underwriting and actual results. Core principle: **the deal
  chooses the strategy**, so every deal is evaluated as BRRRR, Hold, Flip and
  Hybrid.

- Spec (source of truth, § numbers used in code): [docs/SPEC.md](docs/SPEC.md);
  VF-03: [docs/VF03-SPEC.md](docs/VF03-SPEC.md), status + gaps + open decisions:
  [docs/VF03-ALIGNMENT.md](docs/VF03-ALIGNMENT.md)
- Overview, architecture, open decisions, limitations: [README.md](README.md)
- Every rule + provenance: `src/engine/config.ts` → rendered at `/methodology`

## Non-negotiable rules

1. **No invented business rules, thresholds, market data, lender terms or
   property data.** If the spec doesn't define something, don't guess.
   - Make it an input, or
   - add it to `config.ts` tagged `PROVISIONAL` and list it under "Decisions
     that need Guy/Ben approval" in README.md, or
   - ask.
2. **Changing any SPEC value or formula needs explicit approval.** Stop and ask
   before touching `SPEC` in `config.ts` or the formulas in
   `src/engine/formulas.ts`, `underwrite.ts`, `score.ts`, `recommendation.ts`
   or `gates.ts`. When something is approved, retag it from PROVISIONAL to APPROVED,
   note who approved it and when, and remove it from the README's open
   decisions.
3. **UNKNOWN is never $0 (AC18), and we calculate with what's known (§29,
   approved Oct 2026).** A missing numeric input is `null`.
   - **Core drivers** (purchase, rehab, ARV, rent, refi LTV/rate/term) are
     read with `reader.num()` and propagate strictly through `lift()`: a
     result that needs one is UNKNOWN.
   - **Line items** are read with `reader.optional()`. The item itself stays
     `null` (UI: `UNKNOWN`), it's left out of the totals it feeds, and those
     totals are flagged through `RESULT_DEPS` / `CoreResult.inc` (UI: `*`).
   - A new line item must be added to `LINE_ITEMS` and `RESULT_DEPS`. The
     property test in `analyze.test.ts` fails if a result changes without
     being flagged.
   - Partial totals are optimistic: a gate, exit or risk factor that fails on
     them is a proven fail; a pass stays UNKNOWN (`check()` in
     `strategies.ts`). Strengths are only claimed on complete numbers.
   - Never `?? 0` on an input outside these paths. Only an explicitly
     entered 0 is zero.
   - Inputs must flow through `InputReader` so they appear in the
     "Underwriting incomplete — …" warnings.
   - **Default assumptions** (`/settings`) are values Guy/Ben enter. They
     fill blank assumption fields on new deals and are marked "Default".
     Never add system-supplied values.
4. **No division by zero (AC17).** Use `safeDivide`; CoC with $0 left is
   `INFINITE`.
5. **All business logic lives in `src/engine/`.** It is pure TypeScript: no
   React, no I/O, no `Date.now()` (pass `asOf`).
   - Components only format numbers that `analyzeDeal()` / `compStats()`
     return.
   - Formatting lives in `src/lib/format.ts`.
6. **Every formula gets a test with a hand-calculated expectation**, with the
   arithmetic in a comment. Match the spec's examples where it gives one
   (e.g. $60K / $54K = 90%).
7. **Every change is audited (§33).** Deal inputs, notes, status and comps all
   write `deal_audit` rows through the repositories. Don't write to `deals`
   or `deal_comps` outside `deals-repo.ts` / `comps-repo.ts`.
8. **Comps suggest ARV; only the user applies it.** The comp-supported Base
   ARV (`compArv` in `comps.ts`: weighted $/sqft of renovated comps × subject
   sqft) changes `arvBase` only via the audited "Apply" action. Imports (§30)
   may fill property facts, never ARV or rehab, without that explicit step.
   Weighting numbers in `PROVISIONAL.compArv` await confirmation.
9. **Hard gates beat the score.** Never let a score path reach BUY with a
   FAIL or UNKNOWN gate.
10. **Saves are transactional and locked.** Multi-statement writes go through
    `db.transaction()` (inside it use only the `tx` handle: PGlite has one
    connection). Deal edits pass `expectedVersion`; a stale form gets
    `DealConflictError`, never a silent overwrite. Each save also writes an
    analysis snapshot (`snapshotDeal`). **Bump `ENGINE_VERSION` in
    `config.ts` with any rule or formula change.**
11. **Every page and server action checks the user.** Pages call
    `requireUser()` / `requireAdmin()`; actions call `currentUser()` /
    `currentActor()` and refuse without one. The middleware only checks the
    cookie signature. The audit name is the user's display name.

## Layer rules (all modules)

1. **Work moves down only through a gate** (`src/sourcing/engine/gates.ts`):
   target only where the market's latest decision allows it (KEEP / DRILL_DOWN;
   WATCH with a reason; never DROP / blocked); leads only under an active target;
   a lead outside its buy box needs a written reason to reach underwriting.
2. **A layer reads the decision above, never recomputes it, and never decides
   for the layer below.** Sourcing reads stored market snapshots; its screen and
   indicative check are triage — BUY / INVESTIGATE / PASS exists only in the
   Deal Analyzer.
3. **Dependencies point up the chain only**: `src/engine` imports neither
   `src/market` nor `src/sourcing`; `src/market` never imports `src/sourcing`;
   both use only `@/engine/types`, `@/engine/fields`, `@/engine/analyze` from the
   Deal Analyzer. `src/boundary.test.ts` enforces it. The app layer
   (`src/app`, `src/components`) may compose all three.
4. **Every crossing is recorded** (`market_audit`, `deal_audit`), including the
   market decision a target was opened under and any override reason.
5. **The buy box is the avatar.** Screening applies only the avatar's own ranges
   (a missing fact is "unknown"); never add a screening threshold of our own.

## VF-03 rules (Market Intelligence)

1. **Separate but connected.** `src/market` may import from the Deal Analyzer
   only `@/engine/types`, `@/engine/fields` (the DealInputs contract) and
   `@/engine/analyze` (`analyzeDeal`). `src/engine` never imports `src/market`.
   `src/boundary.test.ts` enforces both (and the sourcing rules above). **Never re-implement an
   underwriting formula in VF-03**: capital efficiency is ratios of
   `analyzeDeal()` outputs over deal samples.
2. **All scoring numbers live in `src/market/engine/config.ts`**, tagged
   VF03-SPEC / PROVISIONAL / INTERPRETATION in `MARKET_METHODOLOGY` (rendered on
   `/markets/methodology`). Changing a weight or threshold needs Guy/Ben's
   approval, like the Deal Analyzer. Admin-configurable thresholds are listed
   in `CONFIGURABLE` and stored with history. Bump `MARKET_ENGINE_VERSION` with
   any rule change.
3. **UNKNOWN is never 0** here either. A metric with no accepted observation is
   absent; every aggregate reports point / low / high / completeness. Missing
   data lowers confidence, never attractiveness. Low confidence, low
   completeness or a thin peer group → a range and no rank (no false precision).
4. **Every value has provenance.** Observations carry value, unit, source,
   sourceUrl, asOf, retrievedAt, confidence, methodology (+version) and a
   validation status. They are **append-only** (DB trigger). Manual evidence
   requires a source; "unsupported assumption" is not a confidence level.
5. **No invented market data.** Demo data is `[DEMO]` synthetic (codes
   99901–99906, not real CBSAs). Never hard-code any market as a winner. V1
   sources are official / primary only (Census ACS, HUD, BLS, FRED, local
   records); no MLS, Zillow scraping, PropStream or paid data without approval.
6. **New data source** = a `MarketDataProvider` in `src/market/ingest/providers`
   added to `registry.ts`, emitting metrics from `metrics.ts`; parser tests
   against recorded responses; credentials only via env and redacted in stored
   URLs. The scoring engine must not change for a new provider.
7. **Decisions are KEEP / WATCH / DROP / DRILL_DOWN** — never BUY/PASS for
   markets. Children (submarket, ZIP) are analyzed only under a promoted parent
   (`analyzable()` in `service.ts`).
8. **Hand-off (in `src/sourcing`) fills property facts and asking price only**;
   ARV / rehab / rent estimates go to the deal notes. The Deal Analyzer stays
   the source of truth.

## Commands

```bash
npm run dev          # http://localhost:3100 (PGlite in .data/pglite unless DATABASE_URL is set)
npm run check        # typecheck + lint + unit/integration tests — run before every commit
npm test             # vitest (unit + integration)
TEST_DATABASE_URL=postgres://… npm test   # repo tests against real PostgreSQL too
npm run e2e          # isolated DB + prod build + Playwright suites (app, comps, markets → sourcing → deal), real sign-in
npm run e2e:auth     # sign-in must cover every path, at / and under a basePath; fail-closed; revocation
E2E_OUT=docs/screenshots npm run e2e      # refresh the README screenshots
npm run db:seed      # [DEMO] deals + comps + 6 [DEMO] markets (illustrative only)
npm run db:migrate   # apply pending db/migrations to DATABASE_URL
```

Local PostgreSQL in a cloud session: `pg_ctlcluster 16 main start`, then
create a superuser role and a database for `TEST_DATABASE_URL`.

Local sign-in: start with `ADMIN_USERNAME=… ADMIN_PASSWORD=…` (12+ characters);
the first admin is created on the first sign-in while `users` is empty.

## Alignment with the spec

[docs/SPEC-ALIGNMENT.md](docs/SPEC-ALIGNMENT.md) maps every spec section to
its status (done / approved change / provisional / not built) and lists the
open gaps. Update it whenever behaviour changes.

## Map

```
src/engine/   types · config (SPEC/PROVISIONAL, ENGINE_VERSION) · fields (input registry) · finance · formulas
              underwrite (+ Max Offer solver) · stress · strategies · gates · score
              recommendation · comps · analyze (single entry point) · fixtures (test data)
src/lib/      db (postgres.js | PGlite, transaction) · migrations · auth/{password,token,throttle,bootstrap,safe-next}
              session · users · users-repo · deals-repo (locking) · deal-snapshots · comps-repo
              comps/{parse-comp,provider} · settings-repo · comp-summary · parse-inputs · audit · format
src/market/   engine/ (pure VF-03 scoring) · ingest/ (providers + pipeline) · lib/ (repo, service) · ui/
src/sourcing/ engine/ (pure: layers, gates, screen, leads/CSV, funnel, handoff) · lib/ (repo, service)
src/app/      login · (app)/ = signed-in area: / dashboard · deals/* · settings · methodology · account
              admin/users · markets/{,[geoId],avatars,ingestion,methodology} · sourcing/{,targets,leads}
              actions · comps-actions · settings-actions · auth-actions · market-actions · sourcing-actions
src/boundary.test.ts  dependency direction between the three modules
src/middleware.ts  sign-in gate (no matcher)
db/migrations/     NNNN_name.sql, applied in order at startup
e2e/          run.sh + login.mjs + app/comps/markets.e2e.mjs · auth-check.sh + auth.e2e.mjs
```

## Adding an input field

1. Add it to `DealInputs` in `types.ts`.
2. Add it to `FIELD_SECTIONS` in `fields.ts`. The form, parser, export and
   audit labels all pick it up from there.
3. Read it with `reader.num()` in the engine.
4. Add tests:
   - a parser round-trip;
   - an engine test with the value known;
   - an engine test with the value `null` (UNKNOWN propagates and is listed in
     `missing`).
5. Old deals read it as UNKNOWN automatically (`toRecord` merges onto
   `emptyInputs()`). No migration is needed.

## Dependencies

- **Next.js is pinned exactly at `15.5.27`** (security). Never use `^` for
  `next` or `eslint-config-next`. Bump only after checking the advisories
  and running `npm run check`, `npm run e2e` and `npm run e2e:auth`.
- `next.config.ts` sets `outputFileTracingRoot` because the repo root has
  its own lockfile.
- **Hidden route / basePath.** `ANALYZER_BASE_PATH` (build time) serves the
  app under e.g. `/vf-internal`; the website rewrites that path to this
  deployment (README → "Deploying"). Use `Link` / `redirect()` for internal
  URLs, never hand-built `/…` strings: they handle the basePath. The session
  cookie is scoped to the basePath.
- **Sign-in fails closed.** In production (`next start`) a missing or short
  `SESSION_SECRET` gives 503 on every request. `AUTH_DISABLED=1` is
  open-access mode (no login, changes recorded as "Open access (login off)",
  no admin), only by the owner's explicit decision. **Currently ON for the
  Railway deployment** (Guy, Oct 5 2026, for open testing); README →
  "Deploying" explains how to switch real sign-in on. `npm start` honours
  `$PORT`.
- **`src/middleware.ts` has no `matcher`, on purpose.** With a basePath,
  a matcher silently skipped the bare `/vf-internal` (the dashboard).
  Public paths are listed in the middleware (`/login`, `/_next/static`,
  `/_next/image`, favicon). `npm run e2e:auth` guards this. Run it after any
  middleware, auth, basePath or Next.js change.
- **React 19 resets a form after its server action.** A form that must keep
  what was typed after an error (e.g. the username on `/login`) needs its own
  state (`LoginForm.tsx`).
- `e2e/run.sh` refuses to start if its port (3199) is busy. A stale server
  serving a rebuilt `.next` gives confusing failures.

## Database gotchas

- **Bind JSON as `$n::text::jsonb`.** postgres.js otherwise stores a JSON
  *string* instead of an object.
- **Numeric columns are `double precision` / `integer`** so drivers return JS
  numbers. Dates are read via `to_char(... 'YYYY-MM-DD')` to avoid timezone
  shifts.
- **Versioned migrations.** A schema change is a new `db/migrations/NNNN_name.sql`
  (next number, no gaps). **Never edit an applied migration**: its checksum is
  stored and startup refuses an edited one. 0001 is the V1 schema (idempotent,
  so pre-migration databases adopt it). Pending migrations run in one
  transaction behind an advisory lock at startup.
- **No `;` inside `--` comments in migrations.** Scripts are split into
  statements on `;` (`$$`-quoted function bodies are kept whole).
- **`market_observations` is append-only** (trigger). Store a new observation;
  never update one.
- **PGlite is single-process.** Stop the dev server before running
  `db:seed` on the same directory. Deployed instances must set
  `DATABASE_URL`.
- **Tests on a persistent DB** must use unique values (e.g. `Date.now()`) and
  never assume an empty table.

## Project skills (`/<name>`, defined in `../.claude/skills/`)

| Skill | Use it when |
|---|---|
| `vf-qa` | Before every commit / PR: full verification and the AC1–AC20 checklist |
| `vf-security` | Touching auth, server actions, repos, SQL, links, env, deps, or before deploying |
| `vf-underwriting-analyst` | Any change to engine math, scoring, gates or recommendations; auditing a deal's numbers |
| `vf-real-estate-investor` | Product and logic review from an acquisitions / BRRRR operator's point of view |
| `vf-property-inspector` | Rehab scope, condition, hard-gate checklist and inspection workflow review |

Persona skills (investor, inspector, analyst) **produce findings and
questions for Guy/Ben**. They never change thresholds or formulas on their
own.

## Documentation is part of every change (mandatory)

Docs are updated **in the same commit** as the code they describe: never
"later", never in a follow-up. Before every commit, check each doc below
against the change. **Add** what's new, **update** what changed, and
**remove** what's no longer true (stale docs are worse than missing ones).

| Doc | Update when |
|---|---|
| `README.md` | Features, commands, architecture map, DB schema, test table (file / count / covers), screenshots list, open decisions, known limitations, deploy steps |
| `CLAUDE.md` (this file) | Rules, commands, code map, gotchas, skills, definition of done |
| `src/engine/config.ts` → `METHODOLOGY` | Any rule added or changed, tagged SPEC / APPROVED / PROVISIONAL / INTERPRETATION. When Guy/Ben approve a provisional rule, retag it and remove it from README "Decisions that need approval" |
| `docs/SPEC-ALIGNMENT.md` | Any change to behaviour vs the spec: status per section, approved changes, open gaps |
| `docs/SPEC.md`, `docs/VF03-SPEC.md` | Never edited, except to add a new spec version from Guy/Ben verbatim |
| `docs/VF03-ALIGNMENT.md` | Any VF-03 behaviour change vs its spec; open decisions M1–M10; deferred items |
| `docs/LAYERS.md` + `src/sourcing/engine/layers.ts` | A layer, gate or module boundary changes; open decisions S1–S3 |
| `src/market/engine/config.ts` → `MARKET_METHODOLOGY` | Any VF-03 rule added or changed (VF03-SPEC / PROVISIONAL / INTERPRETATION) |
| `docs/screenshots/` | UI changed visibly: `E2E_OUT=docs/screenshots npm run e2e` |
| `../CLAUDE.md` (repo root) | The analyzer's location, skills list or isolation from the site changes |
| `../.claude/skills/vf-*` | A skill's commands, checklist, file paths or rules no longer match the code |

Prefer facts that can't go stale: no hardcoded counts or versions in prose
unless the doc owns that number (the README test table does; keep it
exact). Before committing, grep the docs for names you renamed or removed.

## Definition of done

1. `npm run check` is green.
2. `npm run e2e` is green for any UI or flow change, and `npm run e2e:auth`
   for any middleware, auth, basePath, routing or Next.js change. Repo tests
   also against real PostgreSQL (`TEST_DATABASE_URL`) for any SQL change.
3. New logic has hand-calculated tests.
4. **All affected docs are updated in the same commit** (see "Documentation
   is part of every change"): README, this file, `METHODOLOGY`, screenshots,
   skills, and the root CLAUDE.md. Stale statements are removed.
5. No new UNKNOWN-to-0 paths.
6. The marketing site at the repo root still builds. It excludes
   `deal-analyzer/`; don't import across the boundary.
