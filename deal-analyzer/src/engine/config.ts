/**
 * Underwriting thresholds — the ONLY place numeric business rules live.
 *
 * SPEC        = value stated in ValeForge Deal Analyzer Spec v1.0.
 *               Changing it requires Guy/Ben approval.
 * PROVISIONAL = the spec names the concept but gives no number/rule.
 *               These are placeholders so the score can be computed; each is
 *               listed on the /methodology page and in the README as an open
 *               decision. Replace with the approved rule before relying on it.
 */

export const SPEC = {
  maxOffer: {
    /** §21 — default Target All-in / ARV */
    defaultTargetAllInPct: 0.7,
  },
  stress: {
    /** §22 */
    arvFactor: 0.9,
    rentFactor: 0.9,
    rehabFactor: 1.15,
  },
  score: {
    /** §23 Equity Creation — 20% equity creation (Equity / All-in) = full 25, linear below */
    equity: { max: 25, fullAtEquityPct: 0.2 },
    /** §23 Capital Efficiency — 90%+ capital recycled = 25 */
    capital: { max: 25, fullAtRecycledPct: 0.9 },
    /** §23 Cash Flow — DSCR 1.25+ target */
    cashFlow: { max: 20, fullAtDscr: 1.25 },
    /** §23 Exit Flexibility — 3+ = 15, 2 = 10, 1 = 5, 0 = 0 */
    exits: { max: 15, pointsByViableCount: [0, 5, 10, 15] as const },
    /** §23 Risk / Stress */
    risk: { max: 15 },
  },
  recommendation: {
    /** §24 — BUY 80–100, INVESTIGATE 65–79, PASS < 65 */
    buyMin: 80,
    investigateMin: 65,
  },
} as const

export const PROVISIONAL = {
  score: {
    /**
     * §23 says "90%+ = 25" but not how lower values score. Provisional: linear
     * below the target, mirroring the Equity rule.
     */
    capitalScaling: 'linear',
    /**
     * §23 says "based primarily on DSCR, Monthly Cash Flow, CoC — target DSCR 1.25+".
     * Provisional: linear on DSCR only (DSCR / 1.25 × 20).
     */
    cashFlowScaling: 'linear-dscr',
    /**
     * §23 lists five risk factors with no weights. Provisional: 3 points each.
     */
    risk: {
      pointsPerFactor: 3,
      complexityPoints: { Light: 3, Medium: 2, Heavy: 1, Major: 0 },
      confidencePoints: { High: 3, Medium: 1.5, Low: 0 },
    },
  },
  /**
   * Comp-supported ARV (approved method: weighted $/sqft × subject sqft, renovated
   * comps only). Guy/Ben named the weighting criteria — time, distance, similarity
   * (sqft, beds, baths, status) plus "Best fit" / "Super comp" — but not the numbers.
   * Every number below is a placeholder awaiting their confirmation.
   *
   * Each factor falls linearly from 1 (perfect) to `floor` at `floorAt`, then stays
   * at the floor. A comp's weight = tier × recency × distance × similarity.
   */
  compArv: {
    floor: 0.25,
    recency: { floorAtMonths: 12 },
    distance: { floorAtMiles: 2 },
    similarity: {
      /** |comp sqft − subject sqft| / subject sqft */
      sqftFloorAtPct: 0.3,
      bedsFloorAtDiff: 2,
      bathsFloorAtDiff: 2,
      status: { sold: 1, pending: 0.75, active: 0.5 },
    },
    tiers: { standard: 1, bestFit: 2, superComp: 3 },
  },
} as const

/** Human-readable methodology table, rendered on /methodology. */
export interface MethodologyRule {
  area: string
  rule: string
  source: 'SPEC' | 'APPROVED' | 'PROVISIONAL' | 'INTERPRETATION'
}

export const METHODOLOGY: MethodologyRule[] = [
  { area: 'Max Offer', rule: 'Default target All-in / ARV = 70% (editable per deal)', source: 'SPEC' },
  {
    area: 'Max Offer',
    rule: 'Purchase-price-dependent costs (closing %, points, acquisition interest) are recomputed at the offer price, so All-in at the Max Offer equals ARV × target exactly',
    source: 'INTERPRETATION',
  },
  { area: 'Stress', rule: 'ARV −10%, Rent −10%, Rehab +15% (contingency scales with rehab), Combined = all three', source: 'SPEC' },
  { area: 'Score · Equity (25)', rule: 'Equity / All-in (Base ARV); 20% = 25 pts, linear below, 0 if negative', source: 'SPEC' },
  { area: 'Score · Capital (25)', rule: 'Capital Recycled %; 90%+ = 25 pts', source: 'SPEC' },
  { area: 'Score · Capital (25)', rule: 'Linear below 90%, 0 if ≤ 0%', source: 'PROVISIONAL' },
  { area: 'Score · Cash Flow (20)', rule: 'Target DSCR 1.25+', source: 'SPEC' },
  { area: 'Score · Cash Flow (20)', rule: 'Linear on post-refi DSCR: DSCR / 1.25 × 20 (cash flow and CoC not yet weighted)', source: 'PROVISIONAL' },
  { area: 'Score · Exits (15)', rule: '3+ viable exits = 15, 2 = 10, 1 = 5, 0 = 0', source: 'SPEC' },
  {
    area: 'Exit viability',
    rule: 'BRRRR: post-refi cash flow > 0 and DSCR ≥ lender min. Hold: cash flow on acquisition financing > 0. Flip: net profit > 0. Hybrid: a rental exit (BRRRR or Hold) AND Flip are both viable',
    source: 'PROVISIONAL',
  },
  {
    area: 'Score · Risk (15)',
    rule: '5 factors × 3 pts: equity > 0 at Conservative ARV; combined-stress DSCR ≥ lender min; combined-stress flip profit > 0; complexity (Light 3 / Medium 2 / Heavy 1 / Major 0); ARV confidence (High 3 / Medium 1.5 / Low 0)',
    source: 'PROVISIONAL',
  },
  { area: 'Recommendation', rule: 'BUY ≥ 80 with no hard-gate failure; INVESTIGATE 65–79; PASS < 65 or any hard-gate failure', source: 'SPEC' },
  {
    area: 'Recommendation',
    rule: 'Score is rounded to one decimal before classification',
    source: 'INTERPRETATION',
  },
  {
    area: 'Recommendation',
    rule: 'If data or a hard gate is UNKNOWN: PASS when the best possible score is still < 65, otherwise INVESTIGATE (never BUY on incomplete underwriting)',
    source: 'INTERPRETATION',
  },
  { area: 'Hard gates', rule: 'Negative post-refi cash flow, DSCR below lender minimum, and no viable exit are computed; the other six are a user checklist', source: 'INTERPRETATION' },
  { area: 'Closing costs', rule: 'Purchase × Closing %; Closing $ is used only when % is blank', source: 'INTERPRETATION' },
  {
    area: 'Other project costs',
    rule: 'Inspection + Attorney + Title + Other acquisition + Other project costs',
    source: 'INTERPRETATION',
  },
  {
    area: 'Hold',
    rule: 'Hold = keep the property on its acquisition financing (no refi). BRRRR = refinance at Base ARV',
    source: 'INTERPRETATION',
  },
  {
    area: 'Hybrid · Best use of capital',
    rule: 'Among viable strategies, highest annual return on the capital that stays in: BRRRR CoC on Cash Left, Hold CoC on cash invested, Flip ROI × 12 / project months',
    source: 'PROVISIONAL',
  },
  {
    area: 'Comps',
    rule: 'Statistics use included comps only; unknown values are skipped per statistic. $/sqft = sale price / sqft. Comps never set ARV',
    source: 'INTERPRETATION',
  },
  {
    area: 'Comps → deal summary',
    rule: 'On "Apply": comp distance = farthest included comp, comp recency = oldest included sale (months)',
    source: 'INTERPRETATION',
  },
  {
    area: 'Comp ARV',
    rule: 'Comp-supported ARV = weighted average $/sqft of included, renovated comps × subject sqft. Only Base ARV is suggested; it is applied only when the user clicks "Apply" (audited). Conservative / Upside stay manual (approved by Guy, Oct 2026)',
    source: 'APPROVED',
  },
  {
    area: 'Comp ARV · weights',
    rule: 'Weight = tier × recency × distance × similarity. Tier: Standard 1× / Best fit 2× / Super comp 3×. Each factor falls linearly from 1 to a 0.25 floor: recency at 12 months, distance at 2 mi; similarity = average of sqft (floor at 30% size difference), beds (floor at 2 apart), baths (floor at 2 apart), status (Sold 1 / Pending 0.75 / Active 0.5)',
    source: 'PROVISIONAL',
  },
  {
    area: 'Comp ARV · unknowns',
    rule: 'A comp without sale price or sqft cannot give $/sqft and is left out. An unknown sale date, distance, beds, baths or status on a comp counts as the floor (least similar), never as a perfect match. If the subject\'s beds/baths are unknown, that similarity item is skipped for every comp. Subject sqft unknown → comp ARV is UNKNOWN',
    source: 'INTERPRETATION',
  },
  { area: 'Refi', rule: 'Refi loan sized on Base ARV; debt service fully amortizing at the refi rate and term', source: 'INTERPRETATION' },
]
