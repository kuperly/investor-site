# ValeForge internal app (folder `deal-analyzer/`)

**In one sentence:** the internal tool Guy and Ben use to decide *where* to look for real estate
deals, *what* to chase there, and *whether and at what price* to buy, then to record what actually
happened.

| | |
|---|---|
| Status | Internal testing |
| Users | Guy and Ben, each with an account (roles: admin, member) |
| Code | `deal-analyzer/`: a separate Next.js project with its own `package.json`, tests and docs |
| URL / routes | Through the website: `valeforgecapital.com/apps`. Directly: `https://deal-analyzer-production.up.railway.app/apps` |
| Runs on | Railway project `valeforge-deal-analyzer`: service `deal-analyzer` + `Postgres` |
| Data | One PostgreSQL database for all three modules (PGlite locally); versioned migrations in `deal-analyzer/db/migrations/` |
| Owner rules | [deal-analyzer/CLAUDE.md](../../deal-analyzer/CLAUDE.md) |

The folder is still called `deal-analyzer` for historical reasons: the Deal Analyzer was the first
module. It now holds the whole internal app.

## What it does

Three modules, one deployment, one login, one chain of six layers. Work moves down the chain only
through each layer's gate ([LAYERS.md](../../deal-analyzer/docs/LAYERS.md)):

```
Layer 1–2  Market Intelligence (VF-03)  /markets    Where to search?      KEEP / WATCH / DROP / DRILL DOWN
              │ gate: market decision KEEP or DRILL DOWN (WATCH with a written reason)
Layer 3–4  Deal Sourcing                /sourcing   What to chase there?  targets, leads, screen, feasibility, negotiation
              │ gate: lead fits the buy box on physical facts, or a written reason (asking price never blocks)
Layer 5–6  Deal Analyzer                / , /deals  Buy, and at what price? BUY / INVESTIGATE / PASS → actual result
```

| Module | Page |
|---|---|
| Market Intelligence (VF-03) | [market-intelligence.md](../../deal-analyzer/docs/modules/market-intelligence.md) |
| Deal Sourcing | [deal-sourcing.md](../../deal-analyzer/docs/modules/deal-sourcing.md) |
| Deal Analyzer | [deal-analyzer.md](../../deal-analyzer/docs/modules/deal-analyzer.md) |

## How it works (shared platform)

- **Next.js 15 App Router**: server components and server actions. All signed-in pages are under
  `src/app/(app)/`. The actions files (`actions.ts`, `market-actions.ts`, `sourcing-actions.ts`…)
  are the only write paths from the UI.
- **Pure engines, thin infrastructure.** Each module keeps its business rules in a pure TypeScript
  engine with no I/O (`src/engine`, `src/market/engine`, `src/sourcing/engine`). Repositories and
  services in `lib/` folders do the database work. Nothing computes a financial number outside
  `src/engine`.
- **Sign-in**: `src/middleware.ts` guards every path (no `matcher`, on purpose). Sessions are a
  signed httpOnly cookie, checked against the account on every request. It fails closed: in
  production, a missing `SESSION_SECRET` gives 503 everywhere. `AUTH_DISABLED=1` is open-access
  mode, used only by the owner's decision.
- **Database**: `src/lib/db.ts` uses postgres.js when `DATABASE_URL` is set, else PGlite.
  Migrations run automatically on first use, in order, with checksums.
- **Audit everything**: every change records who and when (`deal_audit`, `market_audit`,
  `settings_history`, `user_audit`). Evidence and negotiation events are append-only (database
  triggers).
- **basePath**: built with `ANALYZER_BASE_PATH=/apps` so the website can forward `/apps` to it.
  Internal links must use `Link` / `redirect()`, never hand-built URLs.

## Code map

```
deal-analyzer/
  src/engine/      Deal Analyzer engine (pure)          → modules/deal-analyzer.md
  src/market/      Market Intelligence: engine, ingest, lib, ui → modules/market-intelligence.md
  src/sourcing/    Deal Sourcing: engine, lib            → modules/deal-sourcing.md
  src/lib/         platform: db, migrations, auth, session, users, deals/comps/settings repos, audit
  src/app/         login + (app)/ routes + server actions
  src/components/  shared UI (AnalysisView, DealForm, FeasibilityBlock, NegotiationPanel…)
  src/boundary.test.ts  enforces the dependency direction between the modules
  src/middleware.ts     sign-in gate
  db/migrations/   0001 baseline · 0002 users · 0003 deal integrity · 0004 market intelligence
                   · 0005 deal sourcing · 0006 negotiation log
  e2e/             Playwright suites (app, comps, markets → sourcing → deal) and the auth check
  docs/            specs, alignment docs, LAYERS.md, modules/
```

## Data

One database. Platform tables: `users`, `user_audit`, `settings`, `settings_history`,
`schema_migrations`. Module tables are listed on each module's page. The full schema is in
[deal-analyzer/README.md → "Database schema"](../../deal-analyzer/README.md#database-schema).

## Connections

| Direction | Other app or service | Contract | Defined in | Tested by |
|---|---|---|---|---|
| Receives from | Marketing site | Requests to `/apps/*`, forwarded by the site's rewrite. This app must be built with `ANALYZER_BASE_PATH=/apps` | Site `next.config.ts`; this app's `next.config.ts` | Site `src/lib/analyzer-route.test.ts`; `npm run e2e:auth` (at `/` and `/apps`) |
| Reads from | Census ACS, HUD FMR, BLS LAUS, FRED (public APIs) | Free API keys as Railway variables; one provider per source | `src/market/ingest/providers/` | `src/market/ingest/providers.test.ts` (recorded responses) |

Between its own modules, connections are function calls and shared tables, described on each
module's page under "Connections".

## Rules and decisions

All rules are in [deal-analyzer/CLAUDE.md](../../deal-analyzer/CLAUDE.md). The most important:

- Business thresholds and formulas change only with Guy/Ben's approval, and each carries its
  provenance (SPEC / APPROVED / PROVISIONAL / INTERPRETATION), shown on `/methodology` and
  `/markets/methodology`.
- UNKNOWN is never 0. No invented market data, comps or results.
- A layer reads the decision of the layer above, never recomputes it, and never decides for the
  layer below.
- Open decisions: Deal Analyzer in README → "Decisions that need Guy/Ben approval"; VF-03 M1–M10
  in `docs/VF03-ALIGNMENT.md`; Sourcing S1–S5 in `docs/LAYERS.md`.

## Run, test, deploy

```bash
cd deal-analyzer
npm install
ADMIN_USERNAME=… ADMIN_PASSWORD=… npm run dev   # http://localhost:3100 (PGlite, no setup)
npm run check      # typecheck + lint + unit/integration tests (before every commit)
npm run e2e        # production build + Playwright, real sign-in
npm run e2e:auth   # every path requires a session, at / and at /apps
```

Environment variable names: [deal-analyzer/.env.example](../../deal-analyzer/.env.example). Deploy
steps, the current Railway settings and how to turn real sign-in on:
[deal-analyzer/README.md → "Deploying"](../../deal-analyzer/README.md#deploying-the-apps-route-on-the-investor-website).
Railway redeploys the service on every push to its configured branch.

## Status and known gaps

The README owns the current state: "Known limitations" (comps are manual, no data vendor
connected, PDF via the browser…), and "Deploying" (login mode, which branch Railway builds, which
data keys are set). Update those sections, not this page, when the state changes.

## Read next

[deal-analyzer/CLAUDE.md](../../deal-analyzer/CLAUDE.md) →
[deal-analyzer/README.md](../../deal-analyzer/README.md) →
[docs/LAYERS.md](../../deal-analyzer/docs/LAYERS.md) → the module pages.
Project skills (`.claude/skills/`): `vf-qa`, `vf-security`, `vf-underwriting-analyst`,
`vf-real-estate-investor`, `vf-property-inspector`.
