/**
 * The ValeForge operating model: one chain of layers, each owned by one module, each with an
 * explicit entry gate. Work only moves down the chain through a gate; nothing skips a layer.
 * Rendered on /sourcing so the team operates from the same map.
 */
export interface Layer {
  n: number
  key: string
  name: string
  module: 'Market Intelligence' | 'Deal Sourcing' | 'Deal Analyzer'
  question: string
  output: string
  entryGate: string
  href: string
}

export const LAYERS: Layer[] = [
  {
    n: 1,
    key: 'market',
    name: 'Market (MSA)',
    module: 'Market Intelligence',
    question: 'Would we want to operate here at all?',
    output: 'KEEP / WATCH / DROP / DRILL DOWN per market',
    entryGate: 'Market added to the research queue (official CBSA code)',
    href: '/markets',
  },
  {
    n: 2,
    key: 'area',
    name: 'Target area (submarket / ZIP)',
    module: 'Market Intelligence',
    question: 'Where inside the market?',
    output: 'KEEP / WATCH / DROP per ZIP',
    entryGate: 'Parent market promoted for drill-down',
    href: '/markets',
  },
  {
    n: 3,
    key: 'target',
    name: 'Sourcing target (area × buy box)',
    module: 'Deal Sourcing',
    question: 'What exactly are we hunting for, and where?',
    output: 'Active targets: geography + avatar',
    entryGate: 'Geography evaluated KEEP or DRILL DOWN (WATCH only with a written reason; DROP or blocked never)',
    href: '/sourcing/targets',
  },
  {
    n: 4,
    key: 'lead',
    name: 'Lead (candidate property)',
    module: 'Deal Sourcing',
    question: 'Does this property fit the buy box?',
    output: 'Screened leads: pass / incomplete / fail, with an indicative check',
    entryGate: 'Entered under an active target, with a source; duplicates refused',
    href: '/sourcing/leads',
  },
  {
    n: 5,
    key: 'deal',
    name: 'Deal (full underwriting)',
    module: 'Deal Analyzer',
    question: 'At what price, which strategy — BUY / INVESTIGATE / PASS?',
    output: 'Underwritten deal, score, recommendation',
    entryGate: 'Lead sent to the Deal Analyzer (a failed screen needs a written reason)',
    href: '/',
  },
  {
    n: 6,
    key: 'outcome',
    name: 'Actual result',
    module: 'Deal Analyzer',
    question: 'What really happened vs what we predicted?',
    output: 'Actuals next to the predicted analysis',
    entryGate: 'Deal closed or exited',
    href: '/',
  },
]
