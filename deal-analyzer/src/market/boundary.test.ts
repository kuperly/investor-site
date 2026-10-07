/**
 * The two modules are separate but connected (VF-03 §1, §18–19):
 *  - the Deal Analyzer engine never imports Market Intelligence;
 *  - Market Intelligence touches the Deal Analyzer engine only through its contract
 *    (DealInputs types + field registry) and its single entry point analyzeDeal() — no underwriting formula is
 *    re-implemented or imported piecemeal;
 *  - the VF-03 engine is pure (no I/O, no React, no Date.now()).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(process.cwd(), 'src')
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
const rel = (f: string) => path.relative(root, f)

describe('module boundary', () => {
  it('src/engine never imports src/market', () => {
    const bad = files(path.join(root, 'engine')).flatMap((f) => imports(f).filter((i) => i.includes('market')).map((i) => `${rel(f)} → ${i}`))
    expect(bad).toEqual([])
  })

  it('src/market uses only the Deal Analyzer contract and entry point', () => {
    // Contract = DealInputs types + the field registry (emptyInputs/applyDefaults); entry point = analyzeDeal.
    const allowed = new Set(['@/engine/types', '@/engine/fields', '@/engine/analyze'])
    const bad = files(path.join(root, 'market'))
      .filter((f) => !f.endsWith('.test.ts'))
      .flatMap((f) => imports(f).filter((i) => i.startsWith('@/engine') && !allowed.has(i)).map((i) => `${rel(f)} → ${i}`))
    expect(bad).toEqual([])
  })

  it('the VF-03 engine is pure: no I/O, React, Next or clock', () => {
    const bad = files(path.join(root, 'market', 'engine'))
      .filter((f) => !f.endsWith('.test.ts'))
      .flatMap((f) => {
        const src = readFileSync(f, 'utf8')
        const io = imports(f).filter((i) => /^(node:|react|next|postgres|@electric-sql|@\/lib)/.test(i))
        return [...io.map((i) => `${rel(f)} imports ${i}`), ...(/Date\.now\(|new Date\(\)/.test(src) ? [`${rel(f)} reads the clock`] : [])]
      })
    expect(bad).toEqual([])
  })
})
