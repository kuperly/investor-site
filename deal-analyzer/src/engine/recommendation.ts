/** §24 Recommendation — BUY / INVESTIGATE / PASS. Hard gates (§25) always win. */
import { SPEC } from './config'
import type { GateResult } from './gates'
import type { DealScore } from './score'
import type { Recommendation } from './types'

export interface RecommendationResult {
  recommendation: Recommendation
  reasons: string[]
}

export function classifyScore(score: number): Recommendation {
  if (score >= SPEC.recommendation.buyMin) return 'BUY'
  if (score >= SPEC.recommendation.investigateMin) return 'INVESTIGATE'
  return 'PASS'
}

export function recommend(score: DealScore, gates: GateResult[], dataComplete: boolean): RecommendationResult {
  const failed = gates.filter((g) => g.status === 'FAIL')
  if (failed.length > 0) {
    return { recommendation: 'PASS', reasons: failed.map((g) => `Hard gate failed: ${g.label}`) }
  }

  const unknownGates = gates.filter((g) => g.status === 'UNKNOWN')
  const incomplete = !score.complete || unknownGates.length > 0 || !dataComplete
  if (!incomplete) {
    const rec = classifyScore(score.total)
    return { recommendation: rec, reasons: [`Score ${score.total} → ${rec}`] }
  }

  const reasons: string[] = []
  if (!score.complete || !dataComplete) reasons.push('Underwriting incomplete — see missing data')
  for (const g of unknownGates) reasons.push(`Hard gate not yet cleared: ${g.label}`)

  if (score.maxAchievable < SPEC.recommendation.investigateMin) {
    return {
      recommendation: 'PASS',
      reasons: [
        `Score cannot reach ${SPEC.recommendation.investigateMin} even if every unknown resolves favorably (max ${score.maxAchievable})`,
        ...reasons,
      ],
    }
  }
  return { recommendation: 'INVESTIGATE', reasons: ['A BUY requires complete underwriting and all hard gates cleared', ...reasons] }
}
