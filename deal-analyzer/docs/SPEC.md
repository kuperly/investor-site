# ValeForge Deal Analyzer — Full Product Specification v1.0

> Stored verbatim as the source of truth for the MVP. Section numbers (§) are
> referenced throughout the code. Thresholds and formulas here change only
> with Guy/Ben approval.

**Build instructions given with the spec:**
You are building the internal underwriting engine for ValeForge, a US real-estate investment company.
Build the MVP according to the specification below.
Do not invent business rules, financial assumptions, market data, lender terms or missing property data.
Separate all underwriting/business logic from the UI.
All formulas must be unit-testable.
Build the MVP first. Do not add unnecessary integrations or features.
Before changing any threshold or formula defined in this specification, stop and ask for approval.
The core principle is:
The deal chooses the strategy — not the other way around.
The system must evaluate every deal through BRRRR, Hold, Flip and Hybrid perspectives.

---

## 1. מטרת המוצר
לבנות כלי פנימי ל־ValeForge לניתוח עסקאות נדל"ן בארה"ב.
המערכת צריכה לאפשר להזין נכס ולענות בצורה עקבית על:
- האם העסקה יוצרת Equity?
- כמה הון נדרש?
- כמה הון ניתן למחזר?
- האם הנכס עובד כ-Hold?
- האם הוא עובד כ-BRRR?
- האם עדיף Flip?
- מה ה-Max Offer?
- מה קורה בתרחישי Stress?
- מה רמת הסיכון?
- מהו ValeForge Deal Score?
- מהי הפעולה המומלצת: BUY / INVESTIGATE / PASS

**עיקרון מרכזי:** The deal chooses the strategy.
אין להניח מראש שכל עסקה היא BRRRR.
כל נכס צריך להיבחן לפחות כ: BRRRR, Hold, Flip, Hybrid

## 2. משתמשים
**MVP** — שני משתמשים פנימיים: Guy, Ben.
אין צורך במערכת הרשאות מורכבת בגרסה הראשונה.
**Future** — ניתן יהיה להוסיף: Acquisition Analyst, VA, Investor, Partner, Admin

## 3. טכנולוגיה
הסוכן רשאי לבחור Stack, אבל ההמלצה:
- Frontend: React + TypeScript
- Backend: Node.js / TypeScript
- Database: Supabase / PostgreSQL
- Hosting: Vercel / Cloudflare / בהתאם לארכיטקטורה

**חובה** — המערכת צריכה להיות: Responsive, Fast, Maintainable, עם הפרדה בין Business Logic ל-UI.
כל הנוסחאות צריכות להיות בקוד מרכזי אחד ולא מפוזרות בתוך Components.

## 4. מסכי המערכת
### Screen 1 — Deal Dashboard
רשימת כל העסקאות.

Columns: Address, Market, ZIP, Purchase, ARV, All-in, Equity Created, Cash Left, DSCR, Monthly Cash Flow, Flip Profit, Score, Recommendation, Status, Updated

Filters: Market, ZIP, Status, Strategy, Score, Recommendation, Created date

Statuses: Lead, Analyzing, Investigate, Offer, Due Diligence, Under Contract, Closed, Rejected, Archived

## 5. Deal Creation
כפתור: **+ New Deal**

Fields — Property: Address, City, State, ZIP, Property Type, Beds, Baths, Sqft, Year Built, Lot Size, Current Condition

Property Type: SFR, Duplex, Triplex, Fourplex, Multifamily, Other

## 6. Acquisition Inputs
- Purchase: Asking Price, Offer Price, Purchase Price
- Acquisition costs: Closing Costs %, Closing Costs $, Inspection, Attorney, Title, Other
- Rehab: Rehab Estimate, Rehab Contingency %, Rehab Duration, Rehab Complexity
- Complexity: Light, Medium, Heavy, Major

## 7. Financing Inputs
- Acquisition Financing: Loan Type, LTV, Interest Rate, Points, Loan Fees, Loan Term, Interest Only? yes/no
- Refinance: Refi Type, Refi LTV, Interest Rate, Term, Closing Costs %, Prepayment Penalty, Seasoning Requirement

**חשוב:** אין להכניס lender assumptions hard-coded. כל תנאי המימון צריכים להיות Inputs.

## 8. Value Inputs
שלושה ARVs: Conservative ARV, Base ARV, Upside ARV

בנוסף: Number of comps, Average comp price, Median comp price, Comp distance, Comp recency, Renovated comps, Unrenovated comps, ARV Confidence

ARV Confidence: High, Medium, Low

## 9. Rental Inputs
Market Rent, Conservative Rent, Upside Rent, Vacancy %, Property Management %, Taxes, Insurance, HOA, Utilities, Maintenance %, CapEx %, Other OpEx

## 10. Core Calculations
- Closing Costs = Purchase Price × Closing Cost %
- Rehab Contingency = Rehab × Contingency %
- Total Rehab = Rehab + Rehab Contingency
- Acquisition Loan = Purchase Price × Acquisition LTV
- Acquisition Points = Loan Amount × Points %
- Acquisition Interest — For interest-only financing: Loan × Interest Rate × Project Months / 12. אם amortizing: להשתמש ב-amortization schedule אמיתי.

## 11. Total Project Cost / All-in
Purchase + Closing + Rehab + Rehab Contingency + Financing Fees + Acquisition Interest + Holding Costs + Other Project Costs

זה המדד הבסיסי לכל העסקה.

## 12. Equity Creation
ARV − Total Project Cost. להציג עבור: Conservative, Base, Upside

## 13. All-in / ARV
Total Project Cost / ARV. להציג לכל שלושת התרחישים.

## 14. Rental Underwriting
- Gross Scheduled Rent = Monthly Rent × 12
- Vacancy = Gross Rent × Vacancy %
- Effective Gross Income = Gross Rent − Vacancy
- Property Management = Effective Gross Income × Management %
- Maintenance = Gross Rent × Maintenance %
- CapEx = Gross Rent × CapEx %
- NOI = Effective Gross Income − Management − Maintenance − CapEx − Taxes − Insurance − HOA − Utilities − Other OpEx

## 15. BRRRR Analysis
- Refi Loan = ARV × Refi LTV
- Refi Closing Costs = Refi Loan × Refi Closing Cost %
- Existing Debt Payoff = Outstanding Acquisition Loan
- Cash Available From Refi = Refi Loan − Existing Debt − Refi Closing Costs − Other Refi Costs
- Total Cash Invested = Total Project Cost − Acquisition Loan + Any additional equity
- Cash Left in Deal = Total Cash Invested − Cash Recovered

If negative: Cash Left = $0 and excess cash should be displayed separately as: **Cash Released Beyond Original Equity**

## 16. Capital Recycled %
Cash Recovered / Total Cash Invested. Example: $60K invested, $54K recovered = 90%

## 17. DSCR
NOI / Annual Debt Service. Debt service must use the actual modeled refi loan and terms.

## 18. Cash Flow
NOI − Annual Debt Service. Then: Monthly Cash Flow = Annual Cash Flow / 12

## 19. Cash-on-Cash
Annual Cash Flow / Cash Left in Deal. If Cash Left = $0: Display: N/A / Infinite. Do not divide by zero.

## 20. Flip Analysis
- Gross Sale Price: Base ARV.
- Selling Costs = Sale Price × Selling Cost %
- Net Flip Profit = Sale Price − Selling Costs − Total Project Cost
- Flip ROI = Net Profit / Cash Invested
- Flip Margin = Net Profit / Sale Price

## 21. Max Offer
This is a core feature. User selects target: Target All-in / ARV. Default: 70%.

Then: Maximum All-in = ARV × Target All-in %

Then: Maximum Purchase Price = Maximum All-in − Closing Costs − Rehab − Rehab Contingency − Financing − Holding − Other Costs

The system should show: Max Offer — Conservative ARV, Max Offer — Base ARV, Max Offer — Upside ARV

## 22. Stress Testing
Every deal automatically receives:
- Base — No changes.
- ARV −10% — ARV × 90%
- Rent −10% — Rent × 90%
- Rehab +15% — Rehab × 115%
- Combined Stress — ARV −10%, Rent −10%, Rehab +15%

Each scenario must recalculate: All-in, Equity, Refi, Cash Left, DSCR, Cash Flow, Flip Profit

## 23. ValeForge Deal Score
Total: 100 points
- **Equity Creation — 25.** Measures: Equity / All-in, Discount, ARV spread. Initial scoring: 20% equity creation = full 25 points. Linear scaling below that.
- **Capital Efficiency — 25.** Based on: Capital Recycled %, Cash Left, Capital Required. Initial target: 90%+ capital recycled = 25
- **Cash Flow — 20.** Based primarily on: DSCR, Monthly Cash Flow, CoC. Initial target: DSCR 1.25+
- **Exit Flexibility — 15.** Evaluate: BRRRR, Hold, Flip, Hybrid. Suggested: 3+ viable exits = 15, 2 viable exits = 10, 1 viable exit = 5, No viable exit = 0
- **Risk / Stress — 15.** Evaluate: Conservative ARV, Stress DSCR, Stress Flip Profit, Rehab complexity, Comp confidence

## 24. Recommendation
- **BUY** — Score: 80–100 AND no hard gate failure.
- **INVESTIGATE** — Score: 65–79. Requires additional work. Examples: Better comps, Contractor bid, Better financing, Better purchase price, Rent verification
- **PASS** — Score: <65 OR hard gate failure.

## 25. Hard Gates
The score cannot override these. Automatic PASS if:
- No credible ARV
- Major unresolved title issue
- Uninsurable property
- Major structural problem without reliable cost
- No credible exit
- Negative post-refi cash flow
- DSCR below minimum threshold
- Deal depends entirely on appreciation
- Rehab scope cannot be reasonably estimated

## 26. Deal Strategy Engine
The system should calculate separate economics for:
- **BRRRR** — Primary metrics: Capital Recycled, Cash Left, DSCR, Cash Flow, Equity
- **Hold** — Primary metrics: Cash Flow, DSCR, CoC, Equity
- **Flip** — Primary metrics: Net Profit, ROI, Margin, Stress Profit, Time
- **Hybrid** — Compare all three and identify: Best Use of Capital

## 27. Dashboard Output
At the top: `VALEFORGE DEAL SCORE: 84`. Then: `🟢 BUY`. Then: Key Numbers

| Metric | Value |
|---|---|
| Purchase | $XXX |
| All-in | $XXX |
| Base ARV | $XXX |
| Equity Created | $XXX |
| Cash Required | $XXX |
| Cash Left | $XXX |
| Capital Recycled | XX% |
| DSCR | X.XX |
| Monthly Cash Flow | $XXX |
| Flip Profit | $XXX |
| Max Offer | $XXX |

## 28. "Why?"
The system should generate human-readable explanations. Example:

Why this deal scores well
- 22% equity creation
- 94% capital recycled
- DSCR 1.31
- Positive cash flow
- Both BRRRR and Flip exits remain viable

And: Risks
- ARV confidence: Medium
- Rehab contingency may be insufficient
- Conservative scenario reduces DSCR to 1.08

## 29. Data Integrity Rules
המערכת לא תמציא נתונים.
אם נתון חסר: **UNKNOWN** ולא: $0.
לדוגמה: אם Insurance לא ידוע: Insurance = Unknown, והמערכת צריכה להזהיר:
"Underwriting incomplete — insurance estimate required."

## 30. Future Data Integrations
לא נדרש ב-MVP, אבל הארכיטקטורה צריכה לאפשר: Zillow / Redfin / Realtor data, Rent data, Property tax, Insurance estimates, Comps, MLS / Realtor, Google Maps, Public records, Lender terms, AI Listing Parser.

בעתיד נוכל להדביק: Zillow URL, והמערכת תמלא אוטומטית: Address, Asking Price, Beds, Baths, Sqft, Year, Property Type.
אבל לא להכניס אוטומטית ARV או Rehab ללא מקור/אישור.

## 31. Deal Notes
לכל עסקה: General Notes, Realtor Notes, Contractor Notes, Lender Notes, Comp Notes, Risks, Next Steps

## 32. Comparable Properties
בעתיד: כל Deal יכול להכיל Comps: Address, Sale Price, Sale Date, Sqft, Beds, Baths, Distance, Condition, Price/Sqft, Source.
ולהפריד: Renovated Comps מול: Unrenovated Comps

## 33. Audit Trail
כל שינוי משמעותי צריך להישמר:

```
Purchase Price
Old: $125,000
New: $115,000
Changed by: Guy
Date: ...
```

זה חשוב כדי שנוכל להבין בדיעבד למה Deal עבר או נכשל.

## 34. Export
כפתור: **Export Deal**. PDF שיכלול: Property, Inputs, Underwriting, BRRRR, Flip, Hold, Stress Tests, Score, Risks, Recommendation.
בעתיד זה יהיה בסיס להצגה ל-Investor / JV.

## 35. MVP Acceptance Criteria
הסוכן לא סיים את העבודה עד שכל אלה עובדים:
- AC1 — יצירת Deal חדש.
- AC2 — הזנת Purchase / Rehab / ARV / Rent.
- AC3 — All-in מחושב אוטומטית.
- AC4 — Equity Creation מחושב אוטומטית.
- AC5 — Max Offer עובד.
- AC6 — BRRRR עובד.
- AC7 — Refi עובד.
- AC8 — DSCR עובד.
- AC9 — Cash Flow עובד.
- AC10 — Flip Profit עובד.
- AC11 — Stress Tests עובדים.
- AC12 — Score עובד.
- AC13 — Hard Gates עובדים.
- AC14 — BUY / INVESTIGATE / PASS עובד.
- AC15 — Deal נשמר במסד הנתונים.
- AC16 — ניתן לפתוח Deal קיים ולערוך אותו.
- AC17 — אין חלוקה באפס.
- AC18 — נתון חסר אינו הופך אוטומטית ל-$0.
- AC19 — כל הנוסחאות ניתנות לבדיקה.
- AC20 — Mobile + Desktop עובדים.

## 36. מה הסוכן לא צריך לעשות
בגרסה הראשונה:
- ❌ לא לבנות CRM מלא
- ❌ לא לבנות Investor Portal
- ❌ לא לחבר 20 APIs
- ❌ לא להכניס AI רק בשביל "AI"
- ❌ לא להחליט בעצמו על Thresholds
- ❌ לא לשנות את הלוגיקה העסקית ללא אישור
- ❌ לא להכניס נתוני שוק מומצאים

המטרה: **Reliable Underwriting Engine** ולא מערכת ענקית.
