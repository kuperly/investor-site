<!-- Source: ValeForge_VF03_Implementation_Spec_v1.docx, provided by Guy on Oct 7 2026. Text converted to Markdown verbatim. Never edit; add a new version instead. -->

# ValeForge — VF-03 Market Intelligence — Implementation Specification v1

Purpose: Build VF-03 Market Intelligence and integrate it with the existing Deal Analyzer V1 without duplicating or breaking its underwriting engine.

## 1. NON-NEGOTIABLE ARCHITECTURE

VF-03 determines WHERE ValeForge should search, WHAT opportunity types to search for, and WHICH strategy fits.

Deal Analyzer V1 remains the source of truth for property-level underwriting.

Hierarchy:

USA → MSA/Market → Submarket → ZIP/ZCTA → Micro Geography → Avatar → Property Universe → Opportunity → Candidate → Deal Analyzer → Actual Result → Feedback Loop.

Do not rebuild Deal Analyzer calculations. Reuse its existing DealInputs contract and pure TypeScript calculation engine where appropriate.

## 2. FIRST STEP — AUDIT AND RECONCILE EXISTING WORK

Before coding, inspect the current repository and compare the existing implementation against this specification.

The previous V1 audit identified:

- Basic Auth exists but is disabled in production.

- User identity is currently spoofable/hardcoded.

- DB schema is startup/idempotent rather than versioned migrations.

- Market/ZIP are free-text fields on deals.

- No formal geography hierarchy.

- No provenance/freshness model for general market data.

- No stored/versioned analysis snapshots.

- No Market Intelligence module.

- No ingestion infrastructure.

- Deal Analyzer underwriting engine is well separated and should be preserved.

Do not blindly rebuild these pieces. Reconcile them with the current codebase and make the minimum safe architectural changes required.

Required foundation updates before trusting VF-03:

1. Re-enable/strengthen authentication and real users.

2. Introduce versioned database migrations.

3. Introduce provenance/freshness for market data.

4. Introduce structured geography hierarchy.

5. Add market/analysis snapshots.

6. Add ingestion infrastructure.

7. Preserve existing Deal Analyzer engine and tests.

## 3. CORE MARKET MODEL

Implement seven independent dimensions:

A. Market Quality Score

B. Opportunity Density Score

C. Capital Efficiency Score

D. Strategy Fit Score

E. Risk Score

F. Confidence Score

G. Freshness Score

Core Market Priority:

Market Quality 25%

Opportunity Density 30%

Capital Efficiency 25%

Strategy Fit 20%

Risk is a modifier/gating mechanism, not simply another positive/negative weighted metric.

Confidence and Freshness describe evidence quality, not market attractiveness.

## 4. MARKET QUALITY

Question: If we had no specific property yet, would we still want to operate in this market?

Initial metric weights:

- Rental Demand 20%

- Rent Growth 15%

- Population/Household Growth 15%

- Employment/Income 15%

- Housing Supply 10%

- Price Stability/Growth 10%

- Liquidity 10%

- Vacancy 5%

Do not hardcode absolute thresholds prematurely. Normalize metrics against an appropriate peer group and retain raw values.

## 5. OPPORTUNITY DENSITY

Question: How many real opportunities of the type ValeForge targets exist in the market?

Initial weights:

- Distressed 15%

- Off-Market 15%

- Below-Market Transactions 15%

- Investor-Owned/Absentee 10%

- Equity-Rich Owners 10%

- Tax Delinquency 10%

- Foreclosure 10%

- Price Reductions/Failed Listings 10%

- Probate/Other Motivated Sellers 5%

Create an Opportunity Universe concept. Track total properties, rental properties, relevant property types, investor ownership, absentee ownership, distressed indicators and estimated candidate universe.

Do not treat anecdotal claims such as “there are lots of off-market deals” as high-confidence data.

## 6. CAPITAL EFFICIENCY

Question: How much value can ValeForge create from each dollar of ValeForge capital?

Initial weights:

- Equity Creation / Capital Required 25%

- Profit / Capital Required 20%

- Capital Recycled 15%

- Cash Flow / Capital Required 15%

- Leverage Availability 10%

- Refinance Potential 10%

- Multiple Exit Paths 5%

Capital efficiency must not be confused with property price, cap rate or gross ROI.

Use the existing Deal Analyzer for property-level calculations. VF-03 should model market-level/strategy-level capital efficiency using validated deal samples or market assumptions, without duplicating underwriting formulas.

## 7. STRATEGY FIT

Evaluate strategy fit separately for:

- BRRRR

- Buy & Hold

- Fix & Flip

- Section 8/HCV

- Rent by Room

- Small Multifamily

- Off-Market acquisition

- Creative Finance

- Mid-Term Rental where relevant

Each strategy receives a 0–100 fit score based on evidence.

Do not simply average all strategies. Reward Strategic Optionality: a market with several viable strategies is more resilient than one dependent on a single strategy.

Section 8 and Rent-by-Room are strategy overlays, not generic market-quality metrics.

## 8. RISK

Track Risk Score separately, including:

- Crime

- Property taxes

- Insurance

- Housing age

- Rehab complexity

- Tenant/collection risk

- Regulatory risk

- Liquidity risk

- Supply risk

- Economic concentration

- Remote-management complexity

Also support Hard Risk Flags. A critical risk can block advancement regardless of a high market score.

Do not hide material risk inside a single average score.

## 9. CONFIDENCE AND FRESHNESS

Every market data value must support:

value, unit, source, sourceUrl, asOf, retrievedAt, confidence, freshness, geography, methodology.

UNKNOWN is never zero.

Confidence is evidence quality. Official primary data should generally rank highest; verified local/commercial data high; multiple secondary sources medium; single secondary/anecdotal sources low; unsupported assumptions are unacceptable.

Freshness must use metric-specific policies. Do not penalize annual Census data as though it were supposed to be monthly.

Low-confidence evidence must prevent the system from presenting a false-precision market ranking.

## 10. GEOGRAPHY

Implement structured geography:

Country → MSA/Market → Submarket → ZIP/ZCTA → Census Tract → Block Group → Micro Cluster.

ZIP/ZCTA is the practical initial operational geography.

Census Tract/Block Group/Micro Cluster are for deeper analysis.

Neighborhood names may be display/context fields but must not be the primary machine key.

## 11. AVATAR

Create an Avatar model describing the property universe ValeForge wants to pursue.

Example:

3BR SFH; built 1940–1980; 1,100–1,700 sqft; purchase $80K–$150K; ARV $160K–$240K; rent $1,400+; value-add $25K–$60K.

This is illustrative only. Do not hardcode it as the universal ValeForge avatar.

Market/ZIP quality must eventually be evaluated against specific avatars.

## 12. DECISION STATES

Market states:

KEEP

WATCH

DROP

DRILL_DOWN

Never use BUY/PASS for markets. BUY/INVESTIGATE/PASS remains property-level Deal Analyzer terminology.

Initial guidance:

KEEP: core scores strong, no critical risk, evidence sufficient.

DRILL_DOWN: strong parent-level signal that justifies deeper ZIP/micro analysis.

WATCH: interesting thesis but insufficient/weak evidence.

DROP: weak economics/opportunity or material hard risk.

Make thresholds configurable and auditable.

## 13. SCORING

All metrics normalize to 0–100 using appropriate peer groups.

Do not use arbitrary hardcoded rules such as “5% rent growth = 100” unless supported by methodology.

Market Priority:

Market Quality × 25% + Opportunity Density × 30% + Capital Efficiency × 25% + Strategy Fit × 20%.

Apply Risk as a transparent modifier:

Low 1.00; Moderate 0.95; Elevated 0.85; High 0.70; Critical BLOCK.

These initial modifiers are configurable and provisional until validated.

## 14. DATA SOURCES — V1

Start with official/primary sources:

- U.S. Census / ACS

- HUD FMR / SAFMR

- BLS

- FRED

- Local PHA/government sources where available

Do not add MLS, Zillow scraping, PropStream or paid data integrations in the first implementation unless explicitly approved later.

Design ingestion so additional providers can be added without changing the scoring engine.

## 15. INGESTION

Create a source-agnostic ingestion pipeline.

Requirements:

- raw source payload/value

- normalized metric

- geography

- asOf

- retrievedAt

- source

- confidence

- freshness policy

- validation status

- methodology/version

Never overwrite historical values. Store observations/snapshots so market changes can be explained over time.

## 16. SNAPSHOTS AND CHANGE DETECTION

Store Market Intelligence snapshots.

For every significant score change, provide an explanation:

Example:

Market score 78 → 84

Opportunity Density +4

Rent Growth +2

Liquidity +1

Employment +1

Supply Risk -1

The UI must be able to show why a market changed.

## 17. CONDITIONAL DRILL-DOWN

Do not analyze every ZIP in the country.

Only drill MSA → Submarket → ZIP → Micro Geography when the parent level has sufficient score, opportunity, confidence and no blocking risk.

The system should explicitly state why a geography was promoted to the next level.

## 18. PROPERTY / OPPORTUNITY SEPARATION

Keep these concepts separate:

Market: “this geography is attractive”

Opportunity Universe: “there are many properties matching our acquisition thesis”

Candidate: “this specific property deserves underwriting”

Deal Analyzer: “after full underwriting, this property is BUY/INVESTIGATE/PASS”

Do not merge these layers.

## 19. DEAL ANALYZER INTEGRATION

Deal Analyzer V1 remains the source of truth for purchase, closing, rehab, financing, ARV, rent, expenses, NOI, debt service, cash flow, BRRRR, refinance, flip, hold, stress tests and recommendation.

VF-03 must hand off candidate data through a clear data contract compatible with the existing DealInputs contract.

Do not duplicate formulas in VF-03.

## 20. FEEDBACK LOOP

Design for actual-vs-predicted feedback.

Capture:

market, ZIP, micro geography, avatar, property type, purchase, ARV, rehab, rent, timeline, exit, actual profit, actual cash flow, actual refinance, actual capital recovered.

Future versions will compare predictions to actual results and improve the model.

## 21. UI REQUIREMENTS

Market list:

Market, Core Score, Market Quality, Opportunity Density, Capital Efficiency, Strategy Fit, Risk, Confidence, Freshness, Status, Last updated, Change from prior snapshot.

Market detail:

score breakdown, raw metrics, source/provenance, score explanation, historical trend, risks, strategy matrix, opportunity universe, drill-down state.

Geography detail:

same intelligence breakdown, avatar fit, candidate universe, promotion reason.

Never hide raw evidence behind a single score.

## 22. SECURITY / DATA INTEGRITY

Before production use:

- real authenticated users

- no spoofable identity picker

- authorization for edits

- audit trail

- transactional writes where appropriate

- optimistic locking or equivalent concurrency protection

- versioned migrations

- secrets only in environment configuration

Preserve the existing audit trail and test suite.

## 23. DO NOT BUILD YET

Do not implement yet:

- ML/predictive modeling

- AI-generated market scores

- automatic investment decisions

- MLS integration

- Zillow scraping

- PropStream integration

- large paid-data integrations

- automated lead purchasing

First validate the deterministic model.

## 24. VALIDATION PLAN

After implementation, run the model against 10–20 representative U.S. markets.

Then:

1. select strong markets

2. drill into submarkets

3. select ZIPs

4. evaluate avatars

5. inspect actual opportunity universe

6. generate candidate properties

7. hand candidates to Deal Analyzer

8. manually review whether results make sense

The initial market list is a research queue, not ground truth. Do not hardcode DFW, Cleveland, Indianapolis, Memphis, St. Louis, Kansas City or any other market as winners.

## 25. DEFINITION OF DONE

VF-03 V1 is done when:

- structured geography exists

- official data can be ingested

- provenance exists for every metric

- freshness/confidence are calculated

- Market Quality works

- Opportunity Density works

- Capital Efficiency works

- Strategy Fit works

- Risk works

- Market snapshots exist

- change detection works

- conditional drill-down works

- Avatar model exists

- Opportunity Universe exists

- candidate handoff to Deal Analyzer works

- existing Deal Analyzer tests remain green

- no underwriting logic is duplicated

- market decisions are transparent and explainable

- authentication and migrations are production-safe.

## 26. AGENT EXECUTION INSTRUCTION

Execute this specification end-to-end. Do not stop after analysis or after creating a plan.

First inspect the current repository and existing Deal Analyzer implementation. Produce a concise gap analysis against this document, then implement the required foundation and VF-03.

If existing code conflicts with this specification, do not silently choose. Preserve working Deal Analyzer behavior, migrate/extend safely, and document the conflict and resolution in the final report.

Do not ask for confirmation at every stage. Make reasonable implementation decisions consistent with this specification.

At completion, report:

1. files/modules changed

2. database migrations added

3. data sources implemented

4. scoring formulas implemented

5. thresholds/configuration added

6. tests added/updated

7. tests executed and results

8. known limitations

9. deferred items

10. how to run and verify VF-03 locally/production.

