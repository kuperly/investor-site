import { describe, expect, it } from 'vitest'
import type { GateResult } from './gates'
import { classifyScore, recommend } from './recommendation'
import { totalScore, type ScoreComponent } from './score'

const comps = (points: (number | null)[]): ScoreComponent[] =>
  (['equity', 'capital', 'cashFlow', 'exits', 'risk'] as const).map((id, i) => ({
    id,
    label: id,
    max: [25, 25, 20, 15, 15][i],
    points: points[i],
    detail: '',
  }))
const gate = (status: GateResult['status']): GateResult => ({ id: 'g', label: 'Gate', status, detail: '', kind: 'checklist' })

describe('§24 thresholds', () => {
  it.each([
    [100, 'BUY'],
    [80, 'BUY'],
    [79.9, 'INVESTIGATE'],
    [65, 'INVESTIGATE'],
    [64.9, 'PASS'],
    [0, 'PASS'],
  ])('%s → %s', (score, rec) => expect(classifyScore(score)).toBe(rec))
})

describe('recommend', () => {
  it('AC14: BUY when score ≥ 80, data complete and all gates pass', () => {
    expect(recommend(totalScore(comps([25, 25, 20, 10, 5])), [gate('PASS')], true).recommendation).toBe('BUY')
  })
  it('AC13: a hard-gate FAIL forces PASS regardless of score', () => {
    const r = recommend(totalScore(comps([25, 25, 20, 15, 15])), [gate('PASS'), gate('FAIL')], true)
    expect(r.recommendation).toBe('PASS')
    expect(r.reasons[0]).toMatch(/Hard gate failed/)
  })
  it('an UNKNOWN gate blocks BUY → INVESTIGATE', () => {
    expect(recommend(totalScore(comps([25, 25, 20, 15, 15])), [gate('UNKNOWN')], true).recommendation).toBe('INVESTIGATE')
  })
  it('missing data blocks BUY → INVESTIGATE', () => {
    expect(recommend(totalScore(comps([25, 25, 20, 15, 15])), [gate('PASS')], false).recommendation).toBe('INVESTIGATE')
  })
  it('incomplete deals that cannot reach 65 even optimistically → PASS', () => {
    // 5 + 5 + 0 + 0 + unknown(15) = max 25
    const r = recommend(totalScore(comps([5, 5, 0, 0, null])), [gate('PASS')], false)
    expect(r.recommendation).toBe('PASS')
  })
  it('score 65–79 → INVESTIGATE; < 65 → PASS', () => {
    expect(recommend(totalScore(comps([25, 20, 10, 10, 5])), [gate('PASS')], true).recommendation).toBe('INVESTIGATE')
    expect(recommend(totalScore(comps([10, 10, 10, 10, 5])), [gate('PASS')], true).recommendation).toBe('PASS')
  })
})
