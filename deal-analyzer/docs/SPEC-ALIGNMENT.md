# Spec alignment — ValeForge Deal Analyzer vs Spec v1.0

Section-by-section check of the app against [SPEC.md](SPEC.md) (the original
request, kept verbatim). Every rule's provenance is also listed in-app on
`/methodology` (`src/engine/config.ts` → `METHODOLOGY`).

**Status key**

| Status | Meaning |
|---|---|
| ✅ Done | Implemented as written |
| 🟦 Approved change | Differs from or adds to the spec, approved by Guy (date noted) |
| 🟨 Provisional | The spec names the concept but gives no rule; placeholder awaiting approval |
| ⬜ Not built | Not in the MVP: future per the spec, or a gap listed here |

## Build instructions (preamble)

| Instruction | Status | Notes |
|---|---|---|
| Don't invent business rules, financial assumptions, market data, lender terms or property data | ✅ | Lender terms are inputs. Demo data is labelled `[DEMO]`. Default assumptions are entered by Guy/Ben, never supplied by the app. Every gap-filling rule is tagged PROVISIONAL / INTERPRETATION |
| Separate business logic from the UI | ✅ | All math lives in `src/engine` (pure TS). The UI only formats engine output |
| All formulas unit-testable | ✅ | One exported pure function per formula, all with hand-calculated tests |
| MVP first, no unnecessary integrations | ✅ | No external data APIs are connected |
| Ask before changing a spec threshold or formula | ✅ | Each change listed under 🟦 was asked and approved first. Every 🟨 item is listed below as pending |
| Evaluate every deal as BRRRR, Hold, Flip and Hybrid | ✅ | Strategy engine on every deal page |

## Sections

| § | Requirement | Status | Where / notes |
|---|---|---|---|
| 1 | Answers equity, capital, recycled, Hold / BRRRR / Flip, Max Offer, stress, risk, score, BUY/INVESTIGATE/PASS | ✅ | Deal page |
| 2 | Users Guy & Ben, no permission system | ✅ 🟦 | Each has a real account and signs in (VF-03 §22, Oct 2026). Roles: admin (users, VF-03 thresholds) and member; the Deal Analyzer itself has no further permissions |
| 3 | React + TS, Node/TS, Postgres; responsive, fast, maintainable; formulas in one place | ✅ | Next.js 15 + TS; PostgreSQL on Railway (Supabase-compatible); `src/engine` |
| 4 | Dashboard: 15 columns, 7 filters, 9 statuses | ✅ | "ARV" column = Base ARV; the Strategy filter means "viable for" |
| 5 | New Deal: property fields, 6 property types | ✅ | |
| 6 | Acquisition inputs: purchase, costs, rehab, complexity | ✅ | Rehab Duration is recorded but not used in the math. Interest runs on a separate "Project months" input, because the spec's formula says Project Months |
| 7 | Financing: all terms are inputs, no hard-coded lender assumptions | ✅ | Plus "Lender minimum DSCR" as an input, for the §25 gate. Prepayment penalty is stored as text |
| 8 | Three ARVs + comp summary fields + ARV confidence | ✅ 🟦 | Comp summary fields are calculated from the comps list automatically (approved Oct 2026) |
| 9 | Rental inputs | ✅ | Rents monthly; taxes, insurance, HOA, utilities and other OpEx annual (labelled) |
| 10 | Core calculations incl. real amortization schedule | ✅ | `formulas.ts`, `finance.ts` |
| 11 | All-in formula | ✅ | Inspection / attorney / title / other go into "Other project costs" (INTERPRETATION) |
| 12–13 | Equity and All-in / ARV for all three ARVs | ✅ | |
| 14 | Rental underwriting / NOI | ✅ | |
| 15 | BRRRR: refi loan, payoff, cash available, cash invested, cash left (floored at $0), cash released beyond equity | ✅ | |
| 16 | Capital recycled % (incl. the $60K / $54K = 90% example) | ✅ | Tested |
| 17 | DSCR on the modeled refi loan and terms | ✅ | |
| 18 | Cash flow, monthly | ✅ | |
| 19 | CoC; Cash Left $0 → N/A / Infinite, no ÷0 | ✅ | Shown as "∞ (no cash left)" |
| 20 | Flip: base ARV sale, selling costs, profit, ROI, margin | ✅ | Selling cost % is an input |
| 21 | Max Offer, default 70%, three ARVs | ✅ | Price-linked costs are evaluated at the offer price (INTERPRETATION, exact to the cent) |
| 22 | Five stress scenarios recalculating all-in, equity, refi, cash left, DSCR, CF, flip | ✅ | |
| 23 | Score: equity 25 (20% = full, linear) | ✅ | Spec also lists "Discount" and "ARV spread" with no rule → **not scored** (see gap G1) |
| 23 | Capital efficiency 25 (90%+ = full) | ✅ 🟨 | Linear below 90% is provisional. "Cash Left" and "Capital Required" are listed but have no rule → not scored |
| 23 | Cash flow 20 (DSCR 1.25+) | ✅ 🟨 | Scaling on DSCR is provisional. Monthly CF and CoC are listed but not weighted |
| 23 | Exit flexibility 15 (3+/2/1/0) | ✅ 🟨 | Points as spec. What counts as "viable" is provisional |
| 23 | Risk / stress 15 | 🟨 | Five listed factors × 3 pts, provisional weights |
| 24 | BUY 80–100 & no gate fail / INVESTIGATE 65–79 / PASS < 65 or gate fail | ✅ | Plus: incomplete data never gives BUY (INTERPRETATION) |
| 25 | Nine hard gates; score can't override | ✅ | 3 computed, 6 checklist. Gap G2: the literal "negative post-refi CF" gate also PASSes strong flips |
| 26 | Strategy engine: BRRRR / Hold / Flip metrics, Hybrid best use of capital | ✅ 🟨 | "Hold" = keep acquisition financing (INTERPRETATION). Best-use rule is provisional |
| 27 | Score at top, recommendation badge, 11 key numbers | ✅ | |
| 28 | Human-readable "Why?" strengths and risks | ✅ | Generated from computed facts only. The spec example "Rehab contingency may be insufficient" has no rule → not generated (gap G3) |
| 29 | Missing → UNKNOWN, not $0; warn "Underwriting incomplete — … required." | ✅ 🟦 | Missing items show UNKNOWN with the spec warning. **Approved Oct 2026:** results are calculated from the known inputs and marked `*` incomplete (missing items listed), instead of the whole result going UNKNOWN. BUY stays impossible until complete |
| 30 | Architecture ready for integrations; never auto-fill ARV/rehab | ✅ ⬜ | `CompProvider` + `importComps()` exist; no source connected yet. ARV changes only by the user's "Apply" |
| 31 | Seven note categories | ✅ | |
| 32 | Comps (future in spec) | ✅ 🟦 | Built: comp list, renovated/unrenovated split, $/sqft. **Approved additions:** comp-supported ARV (weighted $/sqft × sqft), Best fit / Super comp tiers, Super comp % override. Weighting numbers are 🟨 |
| 33 | Audit trail: old / new / who / when | ✅ | Inputs, notes, status, comps, comp summary sync, ARV apply, actual result. Default-assumption changes have their own history. "Who" is the signed-in user. Saves are transactional with optimistic locking, and each save stores an analysis snapshot |
| 34 | Export Deal → PDF with all sections | ✅ | Print-optimised page → browser "Save as PDF" (limitation: not server-generated) |
| 35 | AC1–AC20 | ✅ | Evidence table in README; `npm run check`, `npm run e2e`, `npm run e2e:auth` |
| 36 | No CRM, investor portal, 20 APIs, gratuitous AI, self-decided thresholds, unapproved logic changes, invented market data | ✅ | |

## Additions beyond the spec (all requested by Guy)

| Addition | Why |
|---|---|
| Default assumptions page (`/settings`) | Requested Oct 2026. Values are entered by Guy/Ben; new deals pre-fill and mark them "Default" |
| Live calculated values in the form | Requested Oct 2026, "the numbers are manual" |
| Hidden route on the website (`/vf-internal`) + Railway hosting + sign-in (fail-closed) | Requested for testing before moving to its own repo |
| VF-03 Market Intelligence module, real accounts, versioned migrations, analysis snapshots, actual-result capture | VF-03 Implementation Spec v1 (Oct 2026) — see [VF03-ALIGNMENT.md](VF03-ALIGNMENT.md) |
| CLAUDE.md, `vf-*` skills, docs-always-current rule | Requested |

## Gaps and open decisions (need Guy/Ben)

| # | Item | Today |
|---|---|---|
| G1 | §23 lists "Discount" and "ARV spread" under Equity, and "Cash Left" / "Capital Required" under Capital Efficiency, without rules | Not scored |
| G2 | §25 "negative post-refi cash flow → PASS" also rejects strong flips (`[DEMO] 7 Flip Only Ln`) | Implemented literally |
| G3 | §28 example "Rehab contingency may be insufficient" has no threshold | Not generated |
| G4 | Provisional scoring: capital linear below 90%; cash flow = DSCR/1.25×20; risk 5×3 pts; exit viability; best use of capital | Placeholders (README "Decisions") |
| G5 | Comp-ARV weighting numbers (tiers 1×/2×/3×, recency 12 mo, distance 2 mi, sqft 30%, beds/baths 2, status 1/0.75/0.5) | Placeholders |
| G6 | Missing acquisition-loan terms → payoff at refi = full principal | INTERPRETATION |
| G7 | Rehab Duration vs Project Months: duration is recorded only | INTERPRETATION |
