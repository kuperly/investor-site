# VF-03 Market Intelligence — gap analysis and alignment

Section-by-section status of the app against [VF03-SPEC.md](VF03-SPEC.md) (kept verbatim).
Every scoring rule and its provenance is also listed in the app on `/markets/methodology`
(`src/market/engine/config.ts` → `MARKET_METHODOLOGY`).

**Status key:** ✅ Done · 🟨 Provisional (the spec names the concept but gives no number, or
calls its numbers "initial"; awaiting Guy/Ben) · ⬜ Not built (deferred, listed below)

## 1. Gap analysis before building (spec §2)

What the V1 audit found, and how each gap was closed:

| V1 gap | Resolution | Where |
|---|---|---|
| Basic Auth disabled in production; identity spoofable (Guy/Ben picker) | Real accounts (`users`, scrypt hashes), signed session cookie, sign-in page, admin user management, "sign out everywhere". The picker is gone. The first admin comes from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Production fails closed without `SESSION_SECRET` | `src/lib/auth/*`, `src/lib/session.ts`, `src/middleware.ts`, `/login`, `/admin/users`, `/account` |
| Startup / idempotent schema instead of versioned migrations | `db/migrations/NNNN_name.sql`, applied once each, in order, in one locked transaction, with checksums (an edited applied migration stops startup). The old schema is migration 0001, so existing databases adopt it as a no-op (verified on PostgreSQL 16) | `src/lib/migrations.ts` |
| No transactions / no concurrency control | A deal save and its audit rows and analysis snapshot commit together. Optimistic locking (`deals.version`, candidates, avatars, outcomes) refuses a save based on an outdated version | `deals-repo.ts`, `actions.ts`, `comps-actions.ts` |
| Market / ZIP were free text on deals | Structured geography: `geographies` keyed by official codes (`cbsa:19100`, `zcta:75216`, `tract:<GEOID>`…); names are display only | migration 0004, `src/market/lib/repo.ts` |
| No provenance / freshness for market data | Every observation stores value, unit, source, sourceUrl, asOf, retrievedAt, confidence, methodology (+version), validation status; freshness is computed per metric policy | `market_observations`, `src/market/engine/freshness.ts` |
| No stored / versioned analysis | Deal analysis snapshots on every save (`ENGINE_VERSION`); market snapshots on every evaluation | `deal_analysis_snapshots`, `market_snapshots` |
| No Market Intelligence module | Built: `src/market/` (engine, ingestion, data, UI), `/markets/*` | |
| No ingestion infrastructure | Source-agnostic pipeline: provider → validate → append-only observations, every run recorded with raw payloads | `src/market/ingest/*` |
| Deal Analyzer engine well separated — preserve | Unchanged: no formula, threshold or rule in `src/engine` was modified. A boundary test enforces that VF-03 only uses the `DealInputs` contract and `analyzeDeal()` | `src/market/boundary.test.ts` |

### Conflicts and how they were resolved (spec §26)

| Conflict | Resolution |
|---|---|
| Guy asked on Oct 5 2026 to turn login off for open testing; VF-03 §2/§22 requires real authenticated users before production use | Real login is built and on by default. `AUTH_DISABLED=1` remains an explicit owner-only switch ("open-access mode"): changes are attributed to "Open access (login off)", there is no admin. The Railway deployment keeps `AUTH_DISABLED=1` until Guy sets the admin credentials (README → Deploying) |
| Deal Analyzer rule: imports never fill ARV or rehab (§30 of the V1 spec); VF-03 §19: hand candidate data to the Deal Analyzer | The hand-off fills property facts and the asking price only. Candidate ARV / rehab / rent estimates go to the deal's notes, marked "NOT applied" |
| VF-03 §6: "Use the existing Deal Analyzer for property-level calculations" vs a market-level score | Market capital efficiency = median of ratios of `analyzeDeal()` outputs over deal samples (linked Deal Analyzer deals or frozen copies). No underwriting formula exists in `src/market` |
| "Separate but connected" (Guy, Oct 7 2026) vs one deployment | Guy chose one deployment with two separate modules: separate engines, tables, screens and tests, one login; connected through the hand-off contract. The boundary test keeps them splittable |
| Submarkets have no official data in V1 | A submarket is a user-defined grouping; its ZIPs follow the MSA's promotion when the submarket itself isn't promoted |

## 2. Section status

| § | Requirement | Status | Where / notes |
|---|---|---|---|
| 1 | VF-03 decides where / what / which strategy; Deal Analyzer stays the source of truth; hierarchy USA → … → Feedback loop | ✅ | Hierarchy: country/MSA/submarket/ZCTA/tract/block group/micro (`PARENT_LEVELS`), avatar, opportunity universe, candidate, hand-off, deal, outcome |
| 2 | Audit, then foundation 1–7 | ✅ | Section 1 above |
| 3 | Seven independent dimensions; priority weights 25/30/25/20; risk is a modifier; confidence & freshness describe evidence | ✅ | `evaluate.ts`, `config.ts`. Weights are the spec's (initial) |
| 4 | Market Quality: 8 metrics, initial weights, peer-normalized, raw retained | ✅ 🟨 | Weights per spec. How each is measured is an INTERPRETATION (see /markets/methodology). Equal weights inside a component are PROVISIONAL |
| 5 | Opportunity Density: 9 components; Opportunity Universe; anecdotal ≠ high confidence | ✅ 🟨 | Two components have official proxies (equity-rich: ACS mortgage status; price reductions: Realtor.com via FRED). The rest are entered from local records with a source and confidence. Anecdotal is the lowest level (15) |
| 6 | Capital Efficiency: 7 components; via the Deal Analyzer, no duplicated formulas | ✅ | `capital.ts` |
| 7 | Strategy Fit for 9 strategies, 0–100 each; optionality, not an average; Section 8 / Rent by Room as overlays | ✅ 🟨 | Roll-up best × 50% + 2nd × 30% + 3rd × 20% is PROVISIONAL. Evidence per strategy is an INTERPRETATION |
| 8 | Risk tracked separately (11 factors); hard flags; critical blocks; no hidden material risk | ✅ 🟨 | Material-risk callout at ≥ 90th percentile and level bands are PROVISIONAL |
| 9 | Every value: value, unit, source, sourceUrl, asOf, retrievedAt, confidence, freshness, geography, methodology; UNKNOWN ≠ 0; confidence order; metric-specific freshness; no false precision | ✅ 🟨 | Confidence scores per level and the precision thresholds are PROVISIONAL; the order is the spec's. ACS margins of error lower confidence |
| 10 | Country → MSA → Submarket → ZIP/ZCTA → Tract → Block Group → Micro; ZCTA operational; names not keys | ✅ ⬜ | Structure and validation built. Data ingestion covers MSA and ZCTA; tract / block group ingestion is deferred |
| 11 | Avatar model; not hard-coded | ✅ | `/markets/avatars`; avatar fit from ACS distributions (estimate, labelled) |
| 12 | KEEP / WATCH / DROP / DRILL_DOWN; never BUY/PASS; thresholds configurable and auditable | ✅ 🟨 | Thresholds PROVISIONAL, admin-editable on /markets/methodology, every change recorded |
| 13 | Normalize 0–100 by peer group; no arbitrary absolute rules; risk modifiers 1.00/0.95/0.85/0.70/BLOCK, configurable | ✅ | Modifiers per spec, configurable |
| 14 | V1 sources: Census/ACS, HUD FMR/SAFMR, BLS, FRED, local PHA/government; no MLS / Zillow / PropStream / paid | ✅ | Four providers + manual entry with source. Providers need free keys (see README); not exercised live in the build environment — parsers tested against recorded responses, ACS variable codes verified against Census metadata |
| 15 | Ingestion: raw payload, normalized metric, geography, asOf, retrievedAt, source, confidence, freshness policy, validation status, methodology/version; never overwrite | ✅ | Append-only (DB trigger blocks updates), duplicates skipped by fingerprint, rejected values kept with reasons (never stored as 0) |
| 16 | Snapshots; explain significant changes | ✅ | `market_snapshots`; `change.ts` splits a change into dimension / component points, risk modifier and coverage |
| 17 | Conditional drill-down with an explicit promotion reason | ✅ | Children are analyzed only under a promoted parent; the promotion stores the checks that passed |
| 18 | Market / Opportunity Universe / Candidate / Deal Analyzer kept separate | ✅ | Separate tables and screens |
| 19 | Hand-off through a contract compatible with DealInputs; no duplicated formulas | ✅ | `handoff.ts` → `deals-repo.create` in one transaction; deal links back (`source_candidate_id`) |
| 20 | Feedback loop: capture actuals | ✅ ⬜ | `deal_outcomes` + form on the deal page, linked to the predicted analysis snapshot. The comparison model is future (per spec) |
| 21 | Market list columns; market detail; geography detail; never hide raw evidence | ✅ | `/markets`, `/markets/[geoId]` |
| 22 | Real users, no spoofable picker, authorization for edits, audit trail, transactions, optimistic locking, versioned migrations, env secrets | ✅ | Admin-only: user management, scoring thresholds. Members edit deals and market data |
| 23 | Do not build ML, AI scores, automatic decisions, MLS, Zillow scraping, PropStream, paid data, lead purchasing | ✅ | None built |
| 24 | Validation plan on 10–20 markets | ⬜ | Needs provider keys and Guy/Ben's research queue. No market is hard-coded; demo markets are `[DEMO]` synthetic data (codes 99901–99906, not real CBSAs) |
| 25 | Definition of done | ✅ / 🟨 | All items built and tested; "official data can be ingested" works once the free API keys are set; provisional numbers await validation |

## 3. Open decisions (need Guy/Ben)

| # | Item | Today |
|---|---|---|
| M1 | Initial weights (§4–§6, §13) | Implemented as the spec states; the spec calls them initial |
| M2 | Equal weights of metrics inside a component | PROVISIONAL |
| M3 | Strategy Fit roll-up (50/30/20) and "viable" fit ≥ 60; each strategy's evidence list | PROVISIONAL / INTERPRETATION |
| M4 | Risk bands (25/45/65), material-risk 90th percentile, equal factor weights | PROVISIONAL |
| M5 | Confidence scores per evidence level (100/80/60/35/15) and confidence labels (75/50) | PROVISIONAL |
| M6 | Precision rule (confidence ≥ 60, completeness ≥ 70%, peers ≥ 5) | PROVISIONAL |
| M7 | Decision thresholds (KEEP 70, DROP 40, confidence 60, freshness 50, risk evidence 50%, risk ≤ Elevated) and drill-down (65 / 50 / 50) | PROVISIONAL, admin-configurable |
| M8 | Directions: housing supply (supply growth above household growth = worse), housing age (older = riskier), price growth (higher = better) | INTERPRETATION |
| M9 | Freshness policy months per source | INTERPRETATION |
| M10 | Avatar fit independence assumption | INTERPRETATION (labelled as an estimate) |

## 4. Deferred (not built in this release)

- Tract / block-group / micro-cluster data ingestion (structure exists).
- Live verification of HUD, BLS and FRED against their APIs (keys needed). Census ACS
  variable codes were verified against the official metadata.
- Scheduled ingestion: runs are on demand (UI or provider loop). A cron can call the same
  pipeline.
- Comparison of actuals vs predictions (data is captured).
- The §24 validation on 10–20 real markets.
