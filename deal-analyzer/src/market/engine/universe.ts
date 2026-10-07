/**
 * Opportunity Universe (VF-03 §5/§18): how many properties match the acquisition thesis in a
 * geography. Counts come straight from evidence; estimates are labelled and show their basis.
 * Separate from the Market score ("this geography is attractive") and from Candidates.
 */
import type { Avatar } from './avatar'
import { avatarFit } from './avatar'
import type { EvidenceMap } from './derive'
import type { ConfidenceLevel } from './types'

export interface UniverseLine {
  key: string
  label: string
  value: number | null
  estimate: boolean
  basis: string
  confidence: ConfidenceLevel | null
}

export function opportunityUniverse(ev: EvidenceMap, avatars: Avatar[] = []): UniverseLine[] {
  const units = ev['acs.housing_units']
  const lines: UniverseLine[] = []
  const direct = (key: string, label: string, metric: string, basis: string) => {
    const e = ev[metric]
    lines.push({ key, label, value: e?.value ?? null, estimate: false, basis, confidence: e?.confidence ?? null })
  }
  const bins = (key: string, label: string, binKeys: string[], basis: string) => {
    const e = ev['acs.units_in_structure_dist']
    const v = e?.detail?.bins ? e.detail.bins.filter((b) => binKeys.includes(b.key)).reduce((s, b) => s + b.count, 0) : null
    lines.push({ key, label, value: v, estimate: false, basis, confidence: e?.confidence ?? null })
  }
  const perUnits = (key: string, label: string, metric: string, per: number, basis: string) => {
    const e = ev[metric]
    lines.push({
      key,
      label,
      value: e && units ? Math.round((e.value * units.value) / per) : null,
      estimate: true,
      basis: e ? `${basis} × housing units` : `${basis} not entered`,
      confidence: e ? e.confidence : null,
    })
  }

  direct('total', 'Total housing units', 'acs.housing_units', 'ACS B25001')
  direct('rental', 'Renter-occupied units', 'acs.renter_occupied', 'ACS B25003')
  bins('sfh', 'Single-family detached units', ['1_detached'], 'ACS B25024')
  bins('smallMf', 'Units in 2–4 unit buildings', ['2', '3_4'], 'ACS B25024')
  perUnits('absentee', 'Absentee-owned properties (est.)', 'opp.absentee_share', 1, 'Absentee share')
  perUnits('investor', 'Investor-owned properties (est.)', 'opp.investor_owned_share', 1, 'Investor-owned share')
  perUnits('distressed', 'Distressed properties (est.)', 'opp.distressed_per_1000', 1000, 'Distressed per 1,000')
  perUnits('taxDelinquent', 'Tax-delinquent parcels (est.)', 'opp.tax_delinquent_per_1000', 1000, 'Tax delinquent per 1,000')
  perUnits('foreclosure', 'Foreclosure filings per year (est.)', 'opp.foreclosure_per_1000', 1000, 'Foreclosures per 1,000')
  perUnits('probate', 'Probate filings per year (est.)', 'opp.probate_per_1000', 1000, 'Probate per 1,000')

  for (const a of avatars.filter((x) => x.active)) {
    const fit = avatarFit(a, ev)
    lines.push({
      key: `avatar:${a.id}`,
      label: `Matching “${a.name}” (est.)`,
      value: fit.estimatedUnits,
      estimate: true,
      basis: fit.matchShare === null ? 'ACS distributions not loaded' : `${(fit.matchShare * 100).toFixed(1)}% of housing units (avatar fit, independence assumed)`,
      confidence: units?.confidence ?? null,
    })
  }
  return lines
}
