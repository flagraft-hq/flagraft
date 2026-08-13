/**
 * Seeds a project, environment, flags and a client key against a running
 * server, then writes the client key to .bench.json for server.ts to use.
 *
 * The root key is inserted straight into the database because there is no
 * HTTP endpoint that can mint the first one. Everything after that goes over
 * HTTP, so the seeded data goes through the same code paths a real caller
 * would use.
 *
 * Usage: DATABASE_URL=... pnpm bench:seed
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { API_KEY_TYPES } from '../src/auth/constants.js'
import { createDb } from '../src/db/index.js'
import { apiKeys } from '../src/db/schema.js'
import { generateKey } from '../src/plugins/auth.js'

const BASE_URL = process.env.BENCH_BASE_URL ?? 'http://localhost:3000'
const FLAG_COUNT = Number(process.env.BENCH_FLAGS ?? 100)
/** A slug per flag count, so benching 10 and 500 does not need a DB wipe. */
const SLUG = `bench-${FLAG_COUNT}`
const OUT = fileURLToPath(new URL('.bench.json', import.meta.url))

async function api<T>(path: string, key: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: key, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401) {
    throw new Error(
      `${path} -> 401. The root key was written to DATABASE_URL, so the server at ` +
        `${BASE_URL} is reading a different database.`,
    )
  }
  if (res.status === 409) {
    throw new Error(
      `Project "${SLUG}" already exists -- this flag count has been seeded before. ` +
        'Delete it, or pick another count with BENCH_FLAGS.',
    )
  }
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/**
 * Confirms a Flagraft server is answering before anything is written. The
 * probe asks the admin API for projects without credentials and expects to be
 * turned away: a 401 proves the route exists and is guarded. Health endpoints
 * are no good for this -- /health and /ready are conventional paths that
 * other frameworks answer with the same {"status":"ok"} body, so an unrelated
 * app on the port would pass.
 */
async function assertServerIsUp() {
  let status: number
  try {
    status = (await fetch(`${BASE_URL}/api/v1/admin/projects`)).status
  } catch {
    throw new Error(`No server responding at ${BASE_URL}. Start it, or set BENCH_BASE_URL.`)
  }

  if (status !== 401) {
    throw new Error(
      `${BASE_URL} answered the admin API with ${status} instead of 401, so it is not a ` +
        'Flagraft server. Check what is on that port and set BENCH_BASE_URL.',
    )
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  await assertServerIsUp()

  const db = createDb(databaseUrl)
  const root = generateKey()
  try {
    await db.insert(apiKeys).values({
      keyHash: root.hash,
      keyPrefix: root.prefix,
      type: API_KEY_TYPES.ADMIN,
      projectId: null,
      environmentId: null,
      description: 'Benchmark root key',
    })
  } finally {
    await db.$pool.end()
  }

  const project = await api<{ id: string }>('/admin/projects', root.plaintext, {
    name: `Benchmark ${FLAG_COUNT}`,
    slug: SLUG,
  })

  const envs = await api<Array<{ id: string; slug: string }>>(
    `/admin/projects/${project.id}/environments`,
    root.plaintext,
  )
  const env = envs.find((e) => e.slug === 'development')
  if (!env) throw new Error('no development environment on the new project')

  /**
   * Flags are created one at a time rather than in parallel so a failure
   * points at a single request instead of a pile of them.
   */
  for (let i = 0; i < FLAG_COUNT; i++) {
    const key = `bench-flag-${i}`
    await api(`/admin/projects/${project.id}/flags`, root.plaintext, { name: key, key })
    /** Half enabled, so evaluation walks both branches like a real project. */
    if (i % 2 === 0) {
      await api(
        `/admin/projects/${project.id}/flags/${key}/environments/${env.slug}/enable`,
        root.plaintext,
        {},
      )
    }
  }

  const clientKey = await api<{ key: string }>(
    `/admin/projects/${project.id}/keys`,
    root.plaintext,
    { type: API_KEY_TYPES.CLIENT, environmentId: env.id, description: 'Benchmark client' },
  )

  /** Grab a live ETag so the 304 scenario has something to match against. */
  const warm = await fetch(`${BASE_URL}/api/v1/client/features`, {
    headers: { authorization: clientKey.key },
  })
  const etag = warm.headers.get('etag')
  if (!etag) throw new Error('server did not return an etag')

  writeFileSync(
    OUT,
    JSON.stringify(
      { baseUrl: BASE_URL, clientKey: clientKey.key, etag, flagCount: FLAG_COUNT },
      null,
      2,
    ),
  )
  console.log(`Seeded ${FLAG_COUNT} flags in project "${SLUG}". Wrote ${OUT}`)
}

void main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exit(1)
})
