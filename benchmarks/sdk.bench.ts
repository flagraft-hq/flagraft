/**
 * Measures the SDK's in-process cost per lookup. Fetch is stubbed, so these
 * numbers are the SDK's own overhead only -- the network and server side of a
 * real call is what server.ts measures.
 *
 * Usage: pnpm bench:sdk
 */
import { bench, describe } from 'vitest'

import { FlagraftClient } from '../packages/sdk-js/src/index.js'
import type { EvaluationContext } from '../packages/sdk-js/src/index.js'

const FLAG_COUNT = Number(process.env.BENCH_FLAGS ?? 100)
const features = Array.from({ length: FLAG_COUNT }, (_, i) => ({
  name: `bench-flag-${i}`,
  enabled: i % 2 === 0,
}))
/** Mid-list, so a linear scan over the bulk payload is paid in full. */
const TARGET = `bench-flag-${Math.floor(FLAG_COUNT / 2)}`
const context: EvaluationContext = { tenant: 'acme', plan: 'pro', region: 'eu-west-1' }

const stubFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new Response(
    JSON.stringify(
      url.includes('/features/') ? { name: TARGET, enabled: true, reason: 'default' } : { features },
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function client(ttl = 30) {
  return new FlagraftClient({
    baseUrl: 'http://bench.local',
    apiKey: 'bench-key',
    ttl,
    fetch: stubFetch,
  })
}

const bulkWarm = client()
const singleWarm = client()
const uncached = client(0)

/** Prime each cache once so the benched calls are pure cache hits. */
await bulkWarm.getFeatures(context)
await singleWarm.isEnabled(TARGET, context)

describe(`sdk (${FLAG_COUNT} flags)`, () => {
  bench('isEnabled (from bulk cache)', async () => {
    await bulkWarm.isEnabled(TARGET, context)
  })

  bench('isEnabled (from single cache)', async () => {
    await singleWarm.isEnabled(TARGET, context)
  })

  bench('getFeatures (cache hit)', async () => {
    await bulkWarm.getFeatures(context)
  })

  /** No cache: every call pays request build + JSON parse of the full payload. */
  bench('isEnabled (cache disabled)', async () => {
    await uncached.isEnabled(TARGET, context)
  })

  bench('getFeatures (cache disabled)', async () => {
    await uncached.getFeatures(context)
  })
})
