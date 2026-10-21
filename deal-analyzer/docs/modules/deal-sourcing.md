# Module: Deal Sourcing (layers 3–4)

**In one sentence:** turns "this market is worth it" into specific properties worth underwriting:
sourcing targets (an area × a buy box), leads under each target, a buy-box screen, a feasibility
check at the asking and target prices, and a negotiation log. It is triage: it never says BUY or
PASS.

| | |
|---|---|
| Part of | [ValeForge internal app](../../../docs/apps/valeforge-internal-app.md) (registry: [docs/apps](../../../docs/apps/README.md)) |
| Users | Guy and Ben, signed in |
| Code | `src/sourcing/engine/` (pure: layers, gates, screen, leads/CSV, funnel, hand-off, negotiation), `src/sourcing/lib/` (repo, service), `src/app/(app)/sourcing/*`, `src/app/sourcing-actions.ts` |
| Routes | `/sourcing` (pipeline: layer map + funnel per market) · `/sourcing/targets` · `/sourcing/leads` |
| Operating model | [LAYERS.md](../LAYERS.md) (also shown in the app on Sourcing → Pipeline, from `src/sourcing/engine/layers.ts`) |

## What it does

1. **Open a target** from a market or ZIP page: a geography × an avatar (buy box). The gate reads the
   market's latest decision: KEEP / DRILL DOWN open freely, WATCH needs a written reason, DROP or a
   blocked market never. Targets whose market decision later changes are flagged.
2. **Add leads** one by one or from a CSV (up to 500 rows). The same property can't enter twice
   (normalized address + ZIP).
3. **Screen** each lead against the avatar's own ranges on physical facts. A missing fact is
   "unknown", never pass or fail. **The asking price is informational and never rejects a lead**
   (Guy/Ben, Oct 15 2026).
4. **Four separate answers per lead:** lead quality; feasibility at asking; feasibility at target (gap
   to Max Offer in $ and %, and which strategies work); negotiation stage and signals. The list is
   ordered by the discount needed off asking, smallest first (an ordering, not a threshold).
5. **Negotiate**: record our offers, seller counters / acceptances / rejections / no response, price
   cuts and outcomes. The likelihood of progress is not scored (UNKNOWN).
6. **Send to Deal Analyzer**: creates the deal in one transaction. A lead outside the buy box on
   physical facts needs a written reason.
7. **Pipeline**: the funnel per market, from targets to leads to deals to actual results.

## How it works

- **Gates**: `targetGate`, `leadGate`, `handoffGate` in `src/sourcing/engine/gates.ts`.
- **Screen and feasibility**: `src/sourcing/engine/screen.ts` (`leadFeasibility` calls the Deal
  Analyzer's `feasibilityAt` with the lead's estimates + ValeForge defaults; `leadQuality`;
  `priorityCompare`). Results are shown on the lead only, never written to a deal.
- **Service**: `openTarget`, `addLead`, `importLeads`, `rescreen`, `handOff`, `pipeline`,
  `recordNegotiation` in `src/sourcing/lib/service.ts`; `latestDecision()` reads the market's
  stored snapshot.
- **Hand-off contract**: `candidateToDeal()` in `src/sourcing/engine/handoff.ts` fills property facts
  and asking price only; ARV / rehab / rent estimates go to the deal notes.

## Data

Migration 0005: `sourcing_targets`; `candidates` gains `target_id`, `address_key`, `screening`,
`screened_at`, `override_reason`. Migration 0006: `negotiation_events` (append-only, by trigger;
linked to a candidate and/or a deal). Changes are recorded in `market_audit` and `deal_audit`.

## Connections

| Direction | Module | Contract | Defined in | Tested by |
|---|---|---|---|---|
| Reads from | Market Intelligence | Latest stored market decision (`market_snapshots`) gates targets; avatars are the buy boxes. Sourcing never scores markets | `src/sourcing/lib/service.ts` (`latestDecision`, `openTarget`) | `src/sourcing/lib/sourcing.test.ts` |
| Reads from | Deal Analyzer | `@/engine/types`, `@/engine/fields`, `@/engine/analyze`, `@/engine/feasibility` | `src/sourcing/engine/screen.ts` | `src/boundary.test.ts`, `src/sourcing/engine/sourcing.test.ts` |
| Sends to | Deal Analyzer | `handOff()` creates the deal (facts + asking price, estimates in notes), sets `deals.source_candidate_id`, snapshots the analysis | `src/sourcing/engine/handoff.ts`, `src/sourcing/lib/service.ts` | sourcing tests, e2e `markets.e2e.mjs` |
| Shares with | Deal Analyzer | `negotiation_events`: the deal page shows the log of the deal and of its lead | `db/migrations/0006_negotiation_log.sql`, `src/sourcing/lib/repo.ts` | `negotiation.test.ts` |

**Direction rule:** Sourcing may use the Market engine's types and the Deal Analyzer's contract and
entry points; neither of them imports Sourcing (`src/boundary.test.ts`).

## Rules and decisions

- The buy box is the avatar: never add a screening threshold of our own.
- The screen and the feasibility check are triage: BUY / INVESTIGATE / PASS exists only in the Deal
  Analyzer.
- Open decisions S1–S5 (S4 decided): [LAYERS.md](../LAYERS.md) → "Decisions to confirm".

## Run, test, deploy

See the [internal app page](../../../docs/apps/valeforge-internal-app.md#run-test-deploy). Tests:
`src/sourcing/engine/sourcing.test.ts`, `negotiation.test.ts`, `src/sourcing/lib/sourcing.test.ts`,
e2e `markets.e2e.mjs` (market → target → lead → deal).

## Status and known gaps

Lead lists are entered by hand or by CSV; no listing feed is connected. Negotiation likelihood is not
scored until a rule calibrated on recorded outcomes is approved (S5).

## Read next

[LAYERS.md](../LAYERS.md) · README → "Deal Sourcing (layers 3–4)" ·
[market-intelligence.md](market-intelligence.md) · [deal-analyzer.md](deal-analyzer.md).
