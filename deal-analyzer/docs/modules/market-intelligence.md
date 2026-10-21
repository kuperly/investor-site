# Module: Market Intelligence, VF-03 (layers 1–2)

**In one sentence:** scores U.S. metro areas (MSAs) and, under a promoted market, their submarkets
and ZIPs, from official public data, and decides KEEP / WATCH / DROP / DRILL DOWN for each. It
answers *where* ValeForge should search. It never says BUY or PASS.

| | |
|---|---|
| Part of | [ValeForge internal app](../../../docs/apps/valeforge-internal-app.md) (registry: [docs/apps](../../../docs/apps/README.md)) |
| Users | Guy and Ben, signed in. Admins can change scoring thresholds (recorded with history) |
| Code | `src/market/engine/` (pure scoring), `src/market/ingest/` (data providers + pipeline), `src/market/lib/` (repo, service), `src/market/ui/`, `src/app/(app)/markets/*`, `src/app/market-actions.ts` |
| Routes | `/markets` (list) · `/markets/[geoId]` (market or ZIP page) · `/markets/avatars` (buy boxes) · `/markets/ingestion` (data sources and runs) · `/markets/methodology` · `/markets/candidates` (old link → `/sourcing/leads`) |
| Spec | [VF03-SPEC.md](../VF03-SPEC.md); status, gaps and open decisions: [VF03-ALIGNMENT.md](../VF03-ALIGNMENT.md) |

## What it does

1. **Load evidence**: providers fetch Census ACS 5-year, HUD Fair Market Rents, BLS LAUS
   (unemployment) and FRED (Realtor.com listings, FHFA house price index). Local evidence can be
   entered by hand, with a required source and an evidence level.
2. **Evaluate**: seven dimensions per geography: Market Quality, Opportunity Density, Capital
   Efficiency, Strategy Fit (9 strategies), Risk (11 factors + hard flags), Confidence, Freshness.
   Metrics become percentiles among peers; a risk modifier scales the core priority; a critical risk
   blocks.
3. **Decide**: KEEP / WATCH / DROP / DRILL DOWN with the reasons. With low confidence, low
   completeness or too few peers, the score is shown as a range and the market is not ranked.
4. **Drill down**: a promoted market can get submarkets and ZIPs, which are scored against their
   siblings.
5. **Explain change**: every "Evaluate now" stores a snapshot; the page explains what moved and why.
6. **Avatars** (buy boxes, defined by Guy/Ben): avatar fit and estimated matching units per
   geography. Deal Sourcing uses the same avatars to screen leads.

## How it works

- **Pure engine**: `evaluateMarkets(geos, config, date)` in `src/market/engine/evaluate.ts`. All
  weights and thresholds are in `src/market/engine/config.ts`, tagged VF03-SPEC / PROVISIONAL /
  INTERPRETATION in `MARKET_METHODOLOGY`; bump `MARKET_ENGINE_VERSION` with any rule change.
- **Service**: `evaluateAll`, `promote`, `canAddChild`, `analyzable` in `src/market/lib/service.ts`
  load the evidence, run the engine and store snapshots.
- **Ingestion**: one `MarketDataProvider` per source in `src/market/ingest/providers/`, registered in
  `registry.ts`. Raw payloads are stored per run; values are validated; rejected values keep their
  reasons and are never scored. Adding a source never changes the scoring engine.
- **UNKNOWN is never 0**: every score has a point, bounds and completeness. Missing data lowers
  confidence, never attractiveness.

## Data

Migration 0004: `geographies` (official codes, parent), `market_observations` (append-only, with
provenance), `ingestion_runs`, `ingestion_raw`, `market_hard_flags`, `market_deal_samples`,
`market_config` (threshold overrides), `market_snapshots`, `geo_promotions`, `avatars`,
`candidates` (owned by Deal Sourcing since migration 0005), `market_audit` (also used by Deal
Sourcing).

## Connections

| Direction | Module or service | Contract | Defined in | Tested by |
|---|---|---|---|---|
| Reads from | Deal Analyzer | `analyzeDeal()` on deals linked (or frozen) as samples of a geography; capital efficiency = median of ratios of its outputs. No underwriting formula exists in this module | `src/market/engine/capital.ts`, `market_deal_samples` | `src/boundary.test.ts`, `engine.test.ts` |
| Provides to | Deal Sourcing | The latest stored decision per geography (`market_snapshots`), read by Sourcing's `latestDecision()` to gate targets. Avatars (buy boxes) | `src/market/lib/repo.ts`; `src/sourcing/lib/service.ts` | `src/sourcing/lib/sourcing.test.ts` |
| Reads from | Census, HUD, BLS, FRED (public APIs) | Free API keys as environment variables (`CENSUS_API_KEY`, `HUD_API_TOKEN`, `BLS_API_KEY`, `FRED_API_KEY`) | `src/market/ingest/providers/` | `providers.test.ts` (recorded responses) |

**Direction rule:** `src/market` never imports `src/sourcing`, and imports from the Deal Analyzer
only `@/engine/types`, `@/engine/fields`, `@/engine/analyze` (`src/boundary.test.ts`).

## Rules and decisions

- Weights and thresholds change only with Guy/Ben's approval. Open decisions M1–M10:
  [VF03-ALIGNMENT.md](../VF03-ALIGNMENT.md) §3.
- No invented market data. Demo markets are `[DEMO]` (codes 99901–99906, not real). No market is
  hard-coded as a winner. V1 sources are official or primary only (no MLS, scraping or paid data
  without approval).
- Decisions are KEEP / WATCH / DROP / DRILL DOWN, never BUY / PASS.

## Run, test, deploy

See the [internal app page](../../../docs/apps/valeforge-internal-app.md#run-test-deploy).
`npm run db:seed` creates the six `[DEMO]` markets. Tests: `src/market/engine/engine.test.ts`,
`src/market/ingest/providers.test.ts`, `src/market/lib/market.test.ts`, e2e `markets.e2e.mjs`.

## Status and known gaps

[VF03-ALIGNMENT.md](../VF03-ALIGNMENT.md) lists the deferred items. A data source shows
"Not configured" on `/markets/ingestion` until its key is set on Railway.

## Read next

[VF03-SPEC.md](../VF03-SPEC.md) · [VF03-ALIGNMENT.md](../VF03-ALIGNMENT.md) ·
[LAYERS.md](../LAYERS.md) · README → "Market Intelligence (VF-03)".
