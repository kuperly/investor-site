# Module: Deal Analyzer (layers 5–6)

**In one sentence:** underwrites one property as BRRRR, Hold, Flip and Hybrid at the same time,
and returns the numbers, a 100-point ValeForge Deal Score and BUY / INVESTIGATE / PASS. Later it
records what actually happened, next to what it predicted.

| | |
|---|---|
| Part of | [ValeForge internal app](../../../docs/apps/valeforge-internal-app.md) (registry: [docs/apps](../../../docs/apps/README.md)) |
| Users | Guy and Ben, signed in |
| Code | `src/engine/` (pure rules), `src/lib/` (deals, comps, settings repositories), `src/app/(app)/` (`/`, `/deals/*`, `/settings`, `/methodology`), `src/components/` (`AnalysisView`, `DealForm`, `FeasibilityBlock`, `NegotiationPanel`) |
| Routes | `/` dashboard · `/deals/new` · `/deals/[id]` · `/deals/[id]/edit` · `/deals/[id]/comps` · `/deals/[id]/export` · `/settings` (default assumptions) · `/methodology` |
| Spec | [SPEC.md](../SPEC.md) (§ numbers are used in the code); status per section: [SPEC-ALIGNMENT.md](../SPEC-ALIGNMENT.md) |

## What it does

1. **Enter a deal**: property facts, purchase price, rehab, ARV (three scenarios), rents, expenses,
   acquisition and refinance financing, and a hard-gate checklist. ValeForge default assumptions
   (`/settings`) pre-fill assumption fields only, marked "Default" until confirmed.
2. **Underwrite**: All-in, equity, Max Offer for each ARV scenario, refinance (LTV, optionally
   capped by the lender's DSCR), DSCR, cash flow, cash left in the deal, flip profit, five stress
   tests.
3. **Decide**: strategy cards (the deal chooses the strategy), hard gates (they override the score),
   the score and BUY / INVESTIGATE / PASS with the reasons, and a "Why?" panel.
4. **Feasibility by price**: the same underwriting at the asking price and at the target price (our
   latest offer, else the planned offer, else the base Max Offer), with the gap to Max Offer in $ and
   %. Max Offer is a metric, never a rejection.
5. **Comps**: a comps list per deal. The comp-supported ARV is a weighted $/sqft of comps marked
   renovated. It is a suggestion: Base ARV changes only when a user applies it (audited).
6. **Track**: status workflow, audit trail, analysis snapshots on every save, the negotiation log,
   an "Actual result" form, and a printable export.

## How it works

- **One entry point**: `analyzeDeal(inputs)` in `src/engine/analyze.ts` returns the full
  `DealAnalysis`. The dashboard, the deal page, the export and the form's live preview all call it.
  `feasibilityAt(inputs, price)` (`feasibility.ts`) is `analyzeDeal` at another price.
  `compArv(comps, subject, asOf)` (`comps.ts`) is the comp-ARV suggestion.
- **Every input may be UNKNOWN** (`null`). Missing core drivers make dependent results UNKNOWN;
  missing line items are left out of totals, which are then marked `*` with the missing list.
  BUY is impossible while anything is missing.
- **Every threshold** lives in `src/engine/config.ts`, tagged SPEC / APPROVED / PROVISIONAL /
  INTERPRETATION in `METHODOLOGY` (rendered on `/methodology`). `ENGINE_VERSION` is stored with
  each snapshot.
- **The input registry** `src/engine/fields.ts` drives the form, the parser, the export and the
  audit labels. Adding a field: [CLAUDE.md → "Adding an input field"](../../CLAUDE.md#adding-an-input-field).

## Data

`deals` (inputs as JSON, `version` for optimistic locking, `source_candidate_id` → the lead it came
from), `deal_audit`, `deal_analysis_snapshots`, `deal_comps`, `deal_outcomes`, `settings` +
`settings_history`; shares `negotiation_events` with Deal Sourcing. Columns:
[README → "Database schema"](../../README.md#database-schema).

## Connections

| Direction | Module | Contract | Defined in | Tested by |
|---|---|---|---|---|
| Provides to | Deal Sourcing | `@/engine/types`, `@/engine/fields` (the `DealInputs` contract), `@/engine/analyze`, `@/engine/feasibility` (lead feasibility at asking / at target) | `src/engine/` | `src/boundary.test.ts`, `src/sourcing/**/*.test.ts` |
| Provides to | Market Intelligence | `@/engine/types`, `@/engine/fields`, `@/engine/analyze`: capital efficiency is the median of ratios of `analyzeDeal()` outputs over deals linked as samples (`market_deal_samples`) | `src/market/engine/capital.ts` | `src/boundary.test.ts`, `src/market/engine/engine.test.ts` |
| Receives from | Deal Sourcing | "Send to Deal Analyzer" creates the deal in one transaction: property facts + asking price; estimates go to the notes, not applied. Links lead ↔ deal (`deals.source_candidate_id`) | `src/sourcing/engine/handoff.ts`, `src/sourcing/lib/service.ts` (`handOff`) | `src/sourcing/lib/sourcing.test.ts`, e2e `markets.e2e.mjs` |
| Feeds back to | Sourcing pipeline and markets | `deal_outcomes` stores the actual result with the candidate, geography, avatar and predicted snapshot, so a market can later be judged by real results | `src/market/lib/repo.ts` (`outcomesRepo`), `src/sourcing/lib/service.ts` (`pipeline`) | `src/sourcing/lib/sourcing.test.ts` |

**Direction rule:** `src/engine` imports neither `src/market` nor `src/sourcing`.

## Rules and decisions

- Business thresholds and formulas change only with Guy/Ben's approval (propose the change, the
  rationale and the tests). Use the `vf-underwriting-analyst` skill for any engine change.
- Hard gates always override the score. Property facts (price, rehab, ARV, rents, taxes, insurance)
  are never defaulted or invented. ARV and rehab are never auto-filled.
- Open decisions: [README.md](../../README.md) → "Decisions that need Guy/Ben approval".

## Run, test, deploy

See the [internal app page](../../../docs/apps/valeforge-internal-app.md#run-test-deploy). Engine
tests are co-located: `src/engine/*.test.ts` (hand-calculated). Test table: README → "Formula /
unit tests".

## Status and known gaps

[README → "Known limitations"](../../README.md#known-limitations): comps are entered by hand (the
`CompProvider` import interface exists, no data source connected), comps affect the score only
through an applied ARV, PDF comes from the browser.

## Read next

[SPEC.md](../SPEC.md) · [SPEC-ALIGNMENT.md](../SPEC-ALIGNMENT.md) · `/methodology` in the app ·
skills `vf-underwriting-analyst`, `vf-real-estate-investor`, `vf-property-inspector`.
