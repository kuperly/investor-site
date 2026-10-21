/**
 * Metric catalogue: every metric VF-03 can store, derive or compute, with its unit, freshness
 * policy and how it may be entered. Raw values are always kept; scores are computed from them.
 *
 *  - raw      stored observations (official API or manual entry with a source)
 *  - derived  computed by derive.ts from raw observations (methodology recorded on the result)
 *  - sample   computed by capital.ts from Deal Analyzer runs of deal samples
 */
import type { FreshnessPolicyKey } from './freshness'

export type MetricUnit =
  | 'count'
  | 'usd'
  | 'usd_month'
  | 'ratio'
  | 'year'
  | 'days'
  | 'index'
  | 'per_1000_units'
  | 'per_100_renters'
  | 'per_1000_residents'
  | 'ordinal_1_5'
  | 'flag'
  | 'distribution'

export interface MetricDef {
  key: string
  label: string
  unit: MetricUnit
  kind: 'raw' | 'derived' | 'sample'
  freshness: FreshnessPolicyKey
  /** May be entered by hand (with a source and confidence) on a geography page. */
  manual?: boolean
  /** Normalization: peer percentile (default) or a fixed scale for ordinal / flag inputs. */
  scale?: { min: number; max: number }
  help?: string
}

const acs = (key: string, label: string, unit: MetricUnit = 'count'): MetricDef => ({ key, label, unit, kind: 'raw', freshness: 'acs5' })
const manual = (key: string, label: string, unit: MetricUnit, help: string, scale?: { min: number; max: number }): MetricDef => ({
  key,
  label,
  unit,
  kind: 'raw',
  freshness: 'manual',
  manual: true,
  help,
  scale,
})
const derived = (key: string, label: string, unit: MetricUnit, freshness: FreshnessPolicyKey = 'acs5'): MetricDef => ({
  key,
  label,
  unit,
  kind: 'derived',
  freshness,
})
const sample = (key: string, label: string, unit: MetricUnit, help: string): MetricDef => ({
  key,
  label,
  unit,
  kind: 'sample',
  freshness: 'deal_sample',
  help,
})

export const METRIC_DEFS: MetricDef[] = [
  // ---- U.S. Census ACS 5-year (official) ----
  acs('acs.population', 'Population'),
  acs('acs.households', 'Households'),
  acs('acs.housing_units', 'Housing units'),
  acs('acs.occupied_units', 'Occupied housing units'),
  acs('acs.owner_occupied', 'Owner-occupied units'),
  acs('acs.renter_occupied', 'Renter-occupied units'),
  acs('acs.vacant_for_rent', 'Vacant units for rent'),
  acs('acs.rented_not_occupied', 'Vacant units rented, not occupied'),
  acs('acs.median_gross_rent', 'Median gross rent', 'usd_month'),
  acs('acs.median_gross_rent_3br', 'Median gross rent, 3 bedrooms', 'usd_month'),
  acs('acs.median_home_value', 'Median home value (owner-occupied)', 'usd'),
  acs('acs.median_household_income', 'Median household income (nominal)', 'usd'),
  acs('acs.median_year_built', 'Median year structure built', 'year'),
  acs('acs.civilian_labor_force', 'Civilian labor force'),
  acs('acs.unemployed', 'Unemployed'),
  acs('acs.median_re_taxes', 'Median real estate taxes paid', 'usd'),
  acs('acs.owner_units_total', 'Owner-occupied units (mortgage status universe)'),
  acs('acs.owner_units_no_mortgage', 'Owner-occupied units without a mortgage'),
  acs('acs.year_built_dist', 'Year built (distribution)', 'distribution'),
  acs('acs.units_in_structure_dist', 'Units in structure (distribution)', 'distribution'),
  acs('acs.bedrooms_dist', 'Bedrooms (distribution)', 'distribution'),
  acs('acs.home_value_dist', 'Home value (distribution, owner-occupied)', 'distribution'),

  // ---- HUD Fair Market Rents (official) ----
  { key: 'hud.fmr_2br', label: 'HUD FMR, 2 bedrooms', unit: 'usd_month', kind: 'raw', freshness: 'hud_fmr' },
  { key: 'hud.fmr_3br', label: 'HUD FMR, 3 bedrooms', unit: 'usd_month', kind: 'raw', freshness: 'hud_fmr' },

  // ---- BLS Local Area Unemployment Statistics (official, monthly) ----
  { key: 'bls.unemployment_rate', label: 'Unemployment rate (BLS LAUS)', unit: 'ratio', kind: 'raw', freshness: 'bls_monthly' },
  { key: 'bls.employment', label: 'Employment (BLS LAUS)', unit: 'count', kind: 'raw', freshness: 'bls_monthly' },

  // ---- FRED (Realtor.com listings: commercial, republished; FHFA HPI: official) ----
  { key: 'fred.median_dom', label: 'Median days on market (Realtor.com via FRED)', unit: 'days', kind: 'raw', freshness: 'fred_monthly' },
  { key: 'fred.active_listings', label: 'Active listings (Realtor.com via FRED)', unit: 'count', kind: 'raw', freshness: 'fred_monthly' },
  { key: 'fred.price_reduced_count', label: 'Listings with a price reduction (Realtor.com via FRED)', unit: 'count', kind: 'raw', freshness: 'fred_monthly' },
  { key: 'fred.hpi', label: 'FHFA all-transactions house price index (via FRED)', unit: 'index', kind: 'raw', freshness: 'fhfa_quarterly' },

  // ---- Manual evidence: local government, PHA, commercial or field research ----
  manual('opp.distressed_per_1000', 'Distressed properties per 1,000 housing units', 'per_1000_units', 'Code violations, vacancy/condemnation lists, distressed listings — count per 1,000 housing units.'),
  manual('opp.off_market_per_1000', 'Off-market opportunities per 1,000 housing units (per year)', 'per_1000_units', 'Documented off-market leads (wholesalers, direct mail responses). Anecdotal claims must be entered as "Anecdotal".'),
  manual('opp.below_market_share', 'Share of sales below market value', 'ratio', 'Share of recorded sales clearly below market (e.g. ≤ 80% of median) — from transaction records.'),
  manual('opp.absentee_share', 'Absentee-owned share of properties', 'ratio', 'From county assessor (owner mailing address ≠ property).'),
  manual('opp.investor_owned_share', 'Investor-owned share of properties', 'ratio', 'Corporate / LLC / multi-property owners, from assessor or commercial data.'),
  manual('opp.tax_delinquent_per_1000', 'Tax-delinquent parcels per 1,000 housing units', 'per_1000_units', 'County treasurer delinquency list.'),
  manual('opp.foreclosure_per_1000', 'Foreclosure filings per 1,000 housing units (per year)', 'per_1000_units', 'Court / county records.'),
  manual('opp.probate_per_1000', 'Probate filings with real estate per 1,000 housing units (per year)', 'per_1000_units', 'Probate court records.'),
  manual('risk.violent_crime_per_1000', 'Violent crimes per 1,000 residents', 'per_1000_residents', 'Local police / FBI UCR.'),
  manual('risk.property_crime_per_1000', 'Property crimes per 1,000 residents', 'per_1000_residents', 'Local police / FBI UCR.'),
  manual('risk.insurance_premium', 'Typical annual landlord insurance premium', 'usd', 'Quote for the target property type.'),
  manual('risk.eviction_filing_rate', 'Eviction filings per 100 renter households', 'per_100_renters', 'Eviction Lab or court records.'),
  manual('risk.regulatory_1_5', 'Regulatory risk (1 low – 5 high)', 'ordinal_1_5', 'Rent control, registration, inspection, eviction rules. Cite the ordinance.', { min: 1, max: 5 }),
  manual('risk.economic_concentration', 'Share of jobs in the largest industry', 'ratio', 'BLS QCEW or local economic development data.'),
  manual('risk.remote_mgmt_1_5', 'Remote-management complexity (1 low – 5 high)', 'ordinal_1_5', 'Property-management availability and cost; cite the source.', { min: 1, max: 5 }),
  manual('risk.rehab_complexity_1_5', 'Typical rehab complexity (1 low – 5 high)', 'ordinal_1_5', 'Contractor availability, permitting, typical scope; cite the source.', { min: 1, max: 5 }),
  manual('strat.pha_payment_standard_pct', 'PHA payment standard as a share of FMR', 'ratio', 'From the local Public Housing Authority (e.g. 1.10 = 110% of FMR).'),
  manual('strat.rbr_allowed', 'Rent by room allowed (1 yes, 0 no)', 'flag', 'Local zoning / occupancy rules. Cite the code section.', { min: 0, max: 1 }),
  manual('strat.rbr_premium', 'Rent-by-room income ÷ whole-unit rent', 'ratio', 'Sum of room rents divided by the whole-unit rent for the same property.'),
  manual('strat.mtr_demand_1_5', 'Mid-term rental demand (1 low – 5 high)', 'ordinal_1_5', 'Hospitals, universities, corporate relocation, furnished-rental occupancy; cite the source.', { min: 1, max: 5 }),
  manual('strat.creative_finance_1_5', 'Creative-finance signal (1 low – 5 high)', 'ordinal_1_5', 'Seller-finance / subject-to activity observed; cite the source.', { min: 1, max: 5 }),

  // ---- Derived from the raw observations above (see derive.ts) ----
  derived('d.renter_share', 'Renter share of occupied units', 'ratio'),
  derived('d.rental_vacancy', 'Rental vacancy rate', 'ratio'),
  derived('d.rent_growth_5y', 'Median gross rent growth, 5 years', 'ratio'),
  derived('d.population_growth_5y', 'Population growth, 5 years', 'ratio'),
  derived('d.household_growth_5y', 'Household growth, 5 years', 'ratio'),
  derived('d.income_growth_5y', 'Median household income growth, 5 years (nominal)', 'ratio'),
  derived('d.unemployment_rate', 'Unemployment rate', 'ratio', 'bls_monthly'),
  derived('d.employment_growth_1y', 'Employment growth, 12 months', 'ratio', 'bls_monthly'),
  derived('d.supply_vs_households_5y', 'Housing-unit growth minus household growth, 5 years', 'ratio'),
  derived('d.home_value_growth_5y', 'Median home value growth, 5 years', 'ratio'),
  derived('d.hpi_growth_1y', 'House price index growth, 12 months', 'ratio', 'fhfa_quarterly'),
  derived('d.hpi_volatility', 'House price volatility (st. dev. of annual change, 5 years)', 'ratio', 'fhfa_quarterly'),
  derived('d.price_reduction_share', 'Share of listings with a price reduction', 'ratio', 'fred_monthly'),
  derived('d.listings_growth_1y', 'Active listings growth, 12 months', 'ratio', 'fred_monthly'),
  derived('d.equity_rich_share', 'Owner-occupied units without a mortgage (equity-rich proxy)', 'ratio'),
  derived('d.effective_tax_rate', 'Effective property tax rate (median taxes ÷ median value)', 'ratio'),
  derived('d.section8_rent_ratio', 'HUD FMR (3 BR) ÷ median 3-BR gross rent', 'ratio', 'hud_fmr'),
  derived('d.small_mf_share', 'Share of housing units in 2–4 unit buildings', 'ratio'),
  derived('d.sfh_share', 'Share of housing units that are single-family detached', 'ratio'),

  // ---- Capital efficiency from Deal Analyzer runs (see capital.ts) ----
  sample('ce.equity_per_capital', 'Equity created ÷ capital required', 'ratio', 'Base-ARV equity ÷ total cash invested'),
  sample('ce.profit_per_capital', 'Flip profit ÷ capital required', 'ratio', 'Flip ROI from the Deal Analyzer'),
  sample('ce.capital_recycled', 'Capital recycled at refinance', 'ratio', 'Capital Recycled % from the Deal Analyzer'),
  sample('ce.cash_flow_per_capital', 'Annual cash flow ÷ capital required', 'ratio', 'Post-refi annual cash flow ÷ total cash invested'),
  sample('ce.leverage', 'Acquisition leverage (loan ÷ all-in)', 'ratio', 'Acquisition loan ÷ total project cost'),
  sample('ce.refi_potential', 'Refinance potential (refi loan ÷ all-in)', 'ratio', 'Refi loan ÷ total project cost'),
  sample('ce.exit_paths', 'Viable exits (of BRRRR, Hold, Flip)', 'count', 'Viable strategies per the Deal Analyzer'),
]

export const METRICS: Record<string, MetricDef> = Object.fromEntries(METRIC_DEFS.map((m) => [m.key, m]))

export const MANUAL_METRICS = METRIC_DEFS.filter((m) => m.manual)

export const metricLabel = (key: string) => METRICS[key]?.label ?? key
