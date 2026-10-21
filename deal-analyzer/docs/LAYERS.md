# ValeForge operating model: layers

How deals are found. Three modules, one chain of six layers. Each layer answers one question,
has one owner module and an explicit **entry gate**. Work moves down only through a gate;
nothing skips a layer. Every deal can therefore be traced back to the market decision that
justified looking there, and every market can be judged later by the deals and actual results
it produced.

The same map is shown in the app on **Sourcing → Pipeline** (`/sourcing`, from
`src/sourcing/engine/layers.ts`).
Each module has a one-page summary: [Market Intelligence](modules/market-intelligence.md),
[Deal Sourcing](modules/deal-sourcing.md), [Deal Analyzer](modules/deal-analyzer.md).

| # | Layer | Module | Question | Entry gate | Output |
|---|---|---|---|---|---|
| 1 | Market (MSA) | Market Intelligence | Would we want to operate here at all? | Market added to the research queue (official CBSA code) | KEEP / WATCH / DROP / DRILL DOWN |
| 2 | Target area (submarket / ZIP) | Market Intelligence | Where inside the market? | Parent market promoted for drill-down | KEEP / WATCH / DROP per ZIP |
| 3 | Sourcing target (area × buy box) | Deal Sourcing | What exactly are we hunting for, and where? | Geography evaluated **KEEP or DRILL DOWN**; WATCH only with a written reason; DROP or blocked never | Active targets |
| 4 | Lead (candidate property) | Deal Sourcing | Does this property fit the buy box, and at what price could it work? | Entered under an **active** target, with a source; duplicates refused | Lead quality (physical fit + evidence), feasibility at asking and at target (gap to Max Offer in $ and %), negotiation log |
| 5 | Deal (full underwriting) | Deal Analyzer | At what price, which strategy — BUY / INVESTIGATE / PASS? | Lead sent to the Deal Analyzer; a lead **outside the buy box on physical facts** needs a written reason (the asking price never blocks) | Underwritten deal, feasibility by price, negotiation log |
| 6 | Actual result | Deal Analyzer | What really happened vs what we predicted? | Deal closed or exited | Actuals next to the predicted analysis snapshot |

## Rules that keep the layers clean

- **A layer reads the decision of the layer above; it never recomputes it.** Sourcing reads
  the market's latest stored snapshot (`latestDecision`). It never scores markets.
- **A layer never decides for the layer below.** The buy-box screen and the lead feasibility check
  (layer 4) are triage. BUY / INVESTIGATE / PASS exists only in layer 5. Markets never get
  BUY / PASS.
- **One engine per question.** Underwriting math exists only in `src/engine`
  (`analyzeDeal`). Market scoring exists only in `src/market/engine`. Sourcing only applies
  the avatar's own ranges and calls `feasibilityAt` (which is `analyzeDeal` at a given price) for its
  feasibility check.
- **Dependencies point up the chain, never down.** `src/engine` imports neither market nor
  sourcing; `src/market` never imports `src/sourcing`; `src/sourcing` may use the market
  engine's types and the Deal Analyzer's contract (`types`, `fields`) and entry point
  (`analyze`). `src/boundary.test.ts` enforces this.
- **Every crossing is recorded.** Target opened (with the market decision and any reason),
  lead created / screened / rejected / sent (with any override reason), deal created from the
  lead (`deals.source_candidate_id`), negotiation events (offers, responses, price cuts,
  outcomes — append-only `negotiation_events`), actual result (`deal_outcomes`, linked to the
  predicted snapshot). All in `market_audit` / `deal_audit`.
- **UNKNOWN is never 0 in any layer.** A lead fact that is missing makes its screen
  criterion "unknown" (never a pass or a fail); missing estimates make the feasibility numbers
  UNKNOWN.

## Operating the pipeline (weekly rhythm, suggested)

1. **Markets**: load new data, *Evaluate now*, read "Why it changed". Promote strong markets
   for drill-down; add their ZIPs; evaluate again.
2. **Targets**: open a target on each KEEP / DRILL DOWN area for each buy box you are working;
   pause or close targets whose market decision has changed (the Targets page flags it).
3. **Leads**: add leads or import lists under their target; work the list from the smallest
   required discount; record offers, seller responses and price cuts; reject what doesn't fit;
   send the rest to the Deal Analyzer.
4. **Deals**: underwrite, decide, track status; record actual results when a deal closes or
   exits.
5. **Pipeline**: review the funnel per market. A market with many leads but no BUYs, or many
   BUYs but poor actuals, is input for the next market review.

## Decisions to confirm (Guy/Ben)

| # | Rule | Today |
|---|---|---|
| S1 | Which market decisions may open a sourcing target | KEEP and DRILL DOWN freely; WATCH with a written reason; DROP / blocked never (INTERPRETATION of VF-03 §12) |
| S2 | Whether a lead outside the buy box may go to underwriting | Yes, with a written reason, recorded on the lead and in the deal's notes |
| S3 | Feasibility check inputs | The lead's ARV / rehab / rent estimates plus ValeForge default assumptions, run at the current asking price (after recorded price cuts) and at the target price (our latest offer, else the base Max Offer). Shown on the lead only; never written to a deal |
| S4 | Asking price outside the avatar's price range | **Decided (Guy/Ben, Oct 15 2026): informational only — never rejects a lead.** The gap to Max Offer is shown and orders the lead list (smallest required discount first) |
| S5 | Likelihood of seller negotiation progress | Not scored (UNKNOWN). Offers, responses, price cuts and outcomes are recorded (`negotiation_events`); a rule calibrated on them needs approval |
