/**
 * Ingestion pipeline (VF-03 §15): provider → validate → append-only observations.
 *  - Every run is recorded (provider, geography, who, request URLs without keys, raw payloads,
 *    counts, errors, methodology version).
 *  - Each value is validated; rejected values are stored with their reasons and never scored.
 *  - Re-running stores nothing twice (fingerprint) and never overwrites history.
 */
import type { Db } from '@/lib/db'
import { MARKET_ENGINE_VERSION } from '../engine/config'
import type { Geography, Observation } from '../engine/types'
import { validateObservation } from '../engine/validate'
import { audit, observationsRepo, runsRepo } from '../lib/repo'
import { configured, type MarketDataProvider, type ProviderContext } from './types'

export interface IngestionSummary {
  runId: string
  status: 'succeeded' | 'partial' | 'failed'
  accepted: number
  rejected: number
  duplicates: number
  errors: string[]
}

export async function runIngestion(db: Db, provider: MarketDataProvider, geo: Geography, by: string, ctx: ProviderContext, parent?: Geography | null): Promise<IngestionSummary> {
  const runs = runsRepo(db)
  const methodologyVersion = `${provider.version}+engine/${MARKET_ENGINE_VERSION}`
  const runId = await runs.start(provider.id, geo.id, by, { provider: provider.id, geo: geo.id }, methodologyVersion)
  const errors: string[] = []
  if (!configured(provider, ctx.env)) {
    const missing = provider.env.filter((e) => e.required && !ctx.env[e.name]).map((e) => e.name)
    errors.push(`Not configured: set ${missing.join(', ')} in the deployment environment`)
    await runs.finish(runId, { status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors })
    return { runId, status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors }
  }
  if (!provider.levels.includes(geo.level)) {
    errors.push(`${provider.name} does not cover ${geo.level} geographies`)
    await runs.finish(runId, { status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors })
    return { runId, status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors }
  }

  let result
  try {
    result = await provider.fetch(geo, ctx, parent)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
    await runs.finish(runId, { status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors })
    return { runId, status: 'failed', accepted: 0, rejected: 0, duplicates: 0, errors }
  }

  const retrievedAt = ctx.now.toISOString()
  const today = retrievedAt.slice(0, 10)
  const counts = { accepted: 0, rejected: 0, duplicates: 0 }
  errors.push(...result.warnings)
  await db.transaction(async (tx) => {
    const obsRepo = observationsRepo(tx)
    await runsRepo(tx).raw(runId, result.payloads)
    for (const f of result.observations) {
      const o: Observation = { ...f, geoId: geo.id, retrievedAt, moe: f.moe ?? null, detail: f.detail ?? null }
      const v = validateObservation(o, today)
      if (v.length) errors.push(`${f.metric} (${f.asOf}): ${v.join('; ')}`)
      const status = await obsRepo.insert(o, { errors: v, methodologyVersion, runId, enteredBy: by, raw: f.raw })
      counts[status === 'duplicate' ? 'duplicates' : status]++
    }
  })
  const status = counts.rejected > 0 ? 'partial' : 'succeeded'
  await runs.finish(runId, { status, ...counts, errors })
  return { runId, status, ...counts, errors }
}

/** A value entered by hand (local records, PHA, field research). Same validation, no run. */
export async function recordManualObservation(db: Db, o: Observation, by: string, today: string): Promise<{ status: 'accepted' | 'rejected' | 'duplicate'; errors: string[] }> {
  const errors = validateObservation(o, today)
  return db.transaction(async (tx) => {
    const status = await observationsRepo(tx).insert(o, { errors, methodologyVersion: `manual+engine/${MARKET_ENGINE_VERSION}`, runId: null, enteredBy: by, raw: { enteredValue: o.value } })
    if (status !== 'duplicate') await audit(tx, 'observation', `${o.geoId}/${o.metric}`, `manual:${status}`, null, { ...o, errors }, by)
    return { status, errors }
  })
}

export function liveContext(): ProviderContext {
  return { fetch: globalThis.fetch.bind(globalThis), env: process.env, now: new Date() }
}
