import { describe, expect, it } from 'vitest'
import { capitalPoints, cashFlowPoints, equityPoints, exitPoints, riskFactorPoints, totalScore } from './score'

describe('§23 score components', () => {
  it('equity: 20% = 25, linear below, clamped', () => {
    expect(equityPoints(0.2)).toBe(25)
    expect(equityPoints(0.3)).toBe(25)
    expect(equityPoints(0.1)).toBeCloseTo(12.5)
    expect(equityPoints(-0.05)).toBe(0)
  })
  it('capital: 90%+ = 25', () => {
    expect(capitalPoints(0.9)).toBe(25)
    expect(capitalPoints(1.2)).toBe(25)
    expect(capitalPoints(0.45)).toBeCloseTo(12.5)
    expect(capitalPoints(-0.1)).toBe(0)
  })
  it('cash flow: DSCR 1.25+ = 20', () => {
    expect(cashFlowPoints(1.25)).toBe(20)
    expect(cashFlowPoints(1.5)).toBe(20)
    expect(cashFlowPoints(0.625)).toBeCloseTo(10)
  })
  it('exits: 3+ = 15, 2 = 10, 1 = 5, 0 = 0', () => {
    expect([0, 1, 2, 3, 4].map(exitPoints)).toEqual([0, 5, 10, 15, 15])
  })
  it('risk: five factors × 3', () => {
    const r = riskFactorPoints({
      conservativeEquity: 10_000,
      stressDscr: 1.1,
      stressDebtService: 10_000,
      minDscr: 1.0,
      stressFlipProfit: 5_000,
      complexity: 'Light',
      confidence: 'High',
    })
    expect(r.reduce((s, f) => s + (f.points ?? 0), 0)).toBe(15)
  })
  it('risk factor is UNKNOWN when its inputs are unknown', () => {
    const r = riskFactorPoints({
      conservativeEquity: null,
      stressDscr: 1.1,
      stressDebtService: 10_000,
      minDscr: null,
      stressFlipProfit: 5_000,
      complexity: null,
      confidence: 'Low',
    })
    expect(r.map((f) => f.points)).toEqual([null, null, 3, null, 0])
  })
})

describe('totalScore', () => {
  it('sums, rounds to 0.1 and reports the optimistic bound for unknowns', () => {
    const s = totalScore([
      { id: 'equity', label: '', max: 25, points: 20.04, detail: '' },
      { id: 'capital', label: '', max: 25, points: null, detail: '' },
      { id: 'cashFlow', label: '', max: 20, points: 10, detail: '' },
      { id: 'exits', label: '', max: 15, points: 15, detail: '' },
      { id: 'risk', label: '', max: 15, points: 9, detail: '' },
    ])
    expect(s.total).toBe(54)
    expect(s.maxAchievable).toBe(79)
    expect(s.complete).toBe(false)
  })
})

describe('risk factors on partial (incomplete) values', () => {
  const base = { stressDscr: 1.1, stressDebtService: 10_000, minDscr: 1.0, complexity: 'Light', confidence: 'High' } as const
  it('a pass on incomplete numbers is not proven → UNKNOWN', () => {
    const r = riskFactorPoints({ ...base, conservativeEquity: 10_000, conservativeEquityIncomplete: true, stressFlipProfit: 5_000, stressFlipIncomplete: true, stressDscrIncomplete: true })
    expect(r.map((f) => f.points).slice(0, 3)).toEqual([null, null, null])
  })
  it('a fail on incomplete numbers is proven → 0 points', () => {
    const r = riskFactorPoints({ ...base, stressDscr: 0.9, conservativeEquity: -5_000, conservativeEquityIncomplete: true, stressFlipProfit: -1, stressFlipIncomplete: true, stressDscrIncomplete: true })
    expect(r.map((f) => f.points).slice(0, 3)).toEqual([0, 0, 0])
  })
  it('no refi debt → DSCR factor passes regardless of incomplete NOI', () => {
    const r = riskFactorPoints({ ...base, stressDebtService: 0, stressDscr: null, stressDscrIncomplete: true, conservativeEquity: 1, stressFlipProfit: 1 })
    expect(r[1].points).toBe(3)
  })
})
