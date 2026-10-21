import { describe, expect, it } from 'vitest'
import { applyDefaults, DEFAULTABLE_KEYS, emptyInputs } from './fields'

describe('ValeForge default assumptions', () => {
  it('fill only BLANK fields and report which were filled', () => {
    const inputs = { ...emptyInputs(), vacancyPct: 0.05 }
    const { inputs: out, filled } = applyDefaults(inputs, { vacancyPct: 0.08, managementPct: 0.1, closingCostPct: 0.03 })
    expect(out.vacancyPct).toBe(0.05) // user value kept
    expect(out.managementPct).toBe(0.1)
    expect(out.closingCostPct).toBe(0.03)
    expect(filled.sort()).toEqual(['closingCostPct', 'managementPct'])
  })
  it('an explicit 0 entered by the user is a value, not blank', () => {
    const { inputs: out, filled } = applyDefaults({ ...emptyInputs(), hoaAnnual: 0 }, { hoaAnnual: 600 })
    expect(out.hoaAnnual).toBe(0)
    expect(filled).toEqual([])
  })
  it('property facts can never be defaulted', () => {
    for (const k of ['purchasePrice', 'rehabEstimate', 'arvBase', 'marketRent', 'taxesAnnual', 'insuranceAnnual', 'holdingCosts']) {
      expect(DEFAULTABLE_KEYS as readonly string[]).not.toContain(k)
    }
  })
  it('no defaults → nothing changes', () => {
    const e = emptyInputs()
    expect(applyDefaults(e, {})).toEqual({ inputs: e, filled: [] })
  })
})
