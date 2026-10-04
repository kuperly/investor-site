/** §22 Stress testing — every deal gets the same five scenarios. */
import { SPEC } from './config'
import type { DealInputs, Num } from './types'
import { InputReader, underwriteCore, type CoreOptions, type CoreResult } from './underwrite'

export type StressId = 'base' | 'arvDown' | 'rentDown' | 'rehabUp' | 'combined'

export const STRESS_SCENARIOS: { id: StressId; label: string; opts: CoreOptions }[] = [
  { id: 'base', label: 'Base', opts: {} },
  { id: 'arvDown', label: 'ARV −10%', opts: { arvFactor: SPEC.stress.arvFactor } },
  { id: 'rentDown', label: 'Rent −10%', opts: { rentFactor: SPEC.stress.rentFactor } },
  { id: 'rehabUp', label: 'Rehab +15%', opts: { rehabFactor: SPEC.stress.rehabFactor } },
  {
    id: 'combined',
    label: 'Combined stress',
    opts: { arvFactor: SPEC.stress.arvFactor, rentFactor: SPEC.stress.rentFactor, rehabFactor: SPEC.stress.rehabFactor },
  },
]

export interface StressRow {
  id: StressId
  label: string
  allIn: Num
  equity: Num
  refiLoan: Num
  cashAvailableFromRefi: Num
  cashLeft: Num
  dscr: Num
  monthlyCashFlow: Num
  flipProfit: Num
}

export function toStressRow(id: StressId, label: string, c: CoreResult): StressRow {
  return {
    id,
    label,
    allIn: c.totalProjectCost,
    equity: c.equityCreated,
    refiLoan: c.refi.refiLoan,
    cashAvailableFromRefi: c.refi.cashAvailableFromRefi,
    cashLeft: c.refi.cashLeftInDeal,
    dscr: c.refi.dscr,
    monthlyCashFlow: c.refi.monthlyCashFlow,
    flipProfit: c.flip.netProfit,
  }
}

export function runStressTests(inputs: DealInputs): StressRow[] {
  return STRESS_SCENARIOS.map((s) => toStressRow(s.id, s.label, underwriteCore(inputs, s.opts, new InputReader(inputs))))
}
