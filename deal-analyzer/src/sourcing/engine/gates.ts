/**
 * Gates between layers (pure). They read decisions made by the layer above; they never
 * re-score anything.
 */
import type { DecisionState } from '@/market/engine/evaluate'
import type { ScreenOverall } from './screen'

export interface GateResult {
  allowed: boolean
  /** Allowed only with a written reason (recorded with the record it opens). */
  needsReason: boolean
  message: string
}

/** Layer 2 → 3: may we open a sourcing target in this geography? */
export function targetGate(latest: { decision: DecisionState; blocked: boolean } | null): GateResult {
  if (!latest) return { allowed: false, needsReason: false, message: 'Not evaluated yet — run Evaluate now on Market Intelligence first.' }
  if (latest.blocked) return { allowed: false, needsReason: false, message: 'Blocked by a critical hard risk flag.' }
  switch (latest.decision) {
    case 'KEEP':
    case 'DRILL_DOWN':
      return { allowed: true, needsReason: false, message: `Market decision ${latest.decision}.` }
    case 'WATCH':
      return { allowed: true, needsReason: true, message: 'Market decision WATCH: opening a target needs a written reason.' }
    case 'DROP':
      return { allowed: false, needsReason: false, message: 'Market decision DROP: not a sourcing area.' }
  }
}

/** Layer 3 → 4: leads enter only under an active target. */
export function leadGate(targetStatus: 'active' | 'paused' | 'closed' | null): GateResult {
  if (targetStatus === 'active') return { allowed: true, needsReason: false, message: 'Target active.' }
  return { allowed: false, needsReason: false, message: targetStatus ? `Target is ${targetStatus}.` : 'Choose an active target.' }
}

/** Layer 4 → 5: a lead that failed its buy-box screen needs a reason to go to underwriting. */
export function handoffGate(screen: ScreenOverall | null): GateResult {
  if (screen === 'fail') return { allowed: true, needsReason: true, message: 'Failed the buy-box screen: sending it to underwriting needs a written reason.' }
  return { allowed: true, needsReason: false, message: screen === 'pass' ? 'Passed the buy-box screen.' : 'Screen incomplete: the Deal Analyzer will list what is missing.' }
}
