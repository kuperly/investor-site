import { describe, expect, it } from 'vitest'
import { sampleInputs } from '@/engine/fixtures'
import { parseDealForm, toFormValues } from './parse-inputs'

const form = (values: Record<string, string>) => (k: string) => values[k] ?? null

describe('parseDealForm', () => {
  it('AC18: blank numeric fields become null (UNKNOWN), not 0', () => {
    const { inputs } = parseDealForm(form({ address: '1 Main', insuranceAnnual: '', purchasePrice: '   ' }))
    expect(inputs.insuranceAnnual).toBeNull()
    expect(inputs.purchasePrice).toBeNull()
  })
  it('an explicit 0 stays 0', () => {
    expect(parseDealForm(form({ address: 'x', hoaAnnual: '0' })).inputs.hoaAnnual).toBe(0)
  })
  it('accepts $ and commas; converts percents to decimals', () => {
    const { inputs } = parseDealForm(form({ address: 'x', purchasePrice: '$125,000', closingCostPct: '3', vacancyPct: '7.5' }))
    expect(inputs.purchasePrice).toBe(125_000)
    expect(inputs.closingCostPct).toBe(0.03)
    expect(inputs.vacancyPct).toBe(0.075)
  })
  it('reports structural errors', () => {
    const { errors } = parseDealForm(
      form({ purchasePrice: 'abc', rehabEstimate: '-5', sqft: '12.5', acqLtv: '120', refiTermYears: '0' }),
    )
    expect(errors).toMatchObject({
      address: expect.any(String),
      purchasePrice: 'Enter a number',
      rehabEstimate: 'Cannot be negative',
      sqft: 'Enter a whole number',
      acqLtv: expect.stringMatching(/between 0 and 100/),
      refiTermYears: expect.any(String),
    })
  })
  it('booleans and gates are tri-state', () => {
    const a = parseDealForm(form({ address: 'x', acqInterestOnly: '', gateTitleIssue: '' })).inputs
    expect(a.acqInterestOnly).toBeNull()
    expect(a.gateTitleIssue).toBe('unknown')
    const b = parseDealForm(form({ address: 'x', acqInterestOnly: 'false', gateTitleIssue: 'yes' })).inputs
    expect(b.acqInterestOnly).toBe(false)
    expect(b.gateTitleIssue).toBe('yes')
  })
  it('round-trips through toFormValues', () => {
    const original = sampleInputs()
    const { inputs, errors } = parseDealForm(form(toFormValues(original)))
    expect(errors).toEqual({})
    expect(inputs).toEqual(original)
  })
})
