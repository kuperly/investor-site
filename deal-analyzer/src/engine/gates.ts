/** §25 Hard gates — the score can never override a FAIL. */
import type { DealInputs, GateAnswer, Num } from './types'
import type { StrategyEvaluation } from './strategies'
import type { CoreResult } from './underwrite'

export type GateStatus = 'PASS' | 'FAIL' | 'UNKNOWN'

export interface GateResult {
  id: string
  label: string
  status: GateStatus
  detail: string
  kind: 'computed' | 'checklist'
}

function checklist(id: string, label: string, answer: GateAnswer): GateResult {
  return {
    id,
    label,
    kind: 'checklist',
    status: answer === 'yes' ? 'FAIL' : answer === 'no' ? 'PASS' : 'UNKNOWN',
    detail: answer === 'yes' ? 'Flagged on checklist' : answer === 'no' ? 'Cleared on checklist' : 'Not yet assessed',
  }
}

export function evaluateGates(
  inputs: DealInputs,
  base: CoreResult,
  strategies: StrategyEvaluation,
  minDscr: Num,
): GateResult[] {
  const arvGate = checklist('noCredibleArv', 'No credible ARV', inputs.gateNoCredibleArv)
  if (arvGate.status === 'PASS' && inputs.arvBase === null) {
    arvGate.status = 'UNKNOWN'
    arvGate.detail = 'Base ARV not entered'
  }

  const exitStatus: GateStatus =
    strategies.viableCount > 0 ? 'PASS' : strategies.incomplete ? 'UNKNOWN' : 'FAIL'

  const cf = base.refi.annualCashFlow
  const cfStatus: GateStatus = cf === null ? 'UNKNOWN' : cf < 0 ? 'FAIL' : 'PASS'

  const dscr = base.refi.dscr
  let dscrStatus: GateStatus
  let dscrDetail: string
  if (base.refi.annualDebtService === 0) {
    dscrStatus = 'PASS'
    dscrDetail = 'No refi debt service modeled'
  } else if (dscr === null) {
    dscrStatus = 'UNKNOWN'
    dscrDetail = 'DSCR cannot be computed'
  } else if (minDscr === null) {
    dscrStatus = 'UNKNOWN'
    dscrDetail = `DSCR ${dscr.toFixed(2)}; lender minimum not entered`
  } else {
    dscrStatus = dscr < minDscr ? 'FAIL' : 'PASS'
    dscrDetail = `DSCR ${dscr.toFixed(2)} vs lender minimum ${minDscr.toFixed(2)}`
  }

  return [
    arvGate,
    checklist('titleIssue', 'Major unresolved title issue', inputs.gateTitleIssue),
    checklist('uninsurable', 'Uninsurable property', inputs.gateUninsurable),
    checklist('structural', 'Major structural problem without reliable cost', inputs.gateStructuralUnknownCost),
    {
      id: 'noCredibleExit',
      label: 'No credible exit',
      kind: 'computed',
      status: exitStatus,
      detail: `${strategies.viableCount} viable exit(s)${strategies.incomplete ? ', some unknown' : ''}`,
    },
    {
      id: 'negativeCashFlow',
      label: 'Negative post-refi cash flow',
      kind: 'computed',
      status: cfStatus,
      detail: cf === null ? 'Cash flow cannot be computed' : `Post-refi cash flow $${Math.round(cf).toLocaleString('en-US')}/yr`,
    },
    { id: 'dscrBelowMin', label: 'DSCR below minimum threshold', kind: 'computed', status: dscrStatus, detail: dscrDetail },
    checklist('appreciationOnly', 'Deal depends entirely on appreciation', inputs.gateAppreciationOnly),
    checklist('rehabNotEstimable', 'Rehab scope cannot be reasonably estimated', inputs.gateRehabNotEstimable),
  ]
}
