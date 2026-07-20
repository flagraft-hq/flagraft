import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { createCache } from '../../src/cache/index.js'
import { featureFlags, flagEnvironments } from '../../src/db/schema.js'
import { buildServer } from '../../src/server.js'
import { getTestDb, truncateAll } from '../helpers/db.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip
const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

describeIfDb('cache invalidation', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /**
   * Shared helper: creates a project, admin key, finds the production environment,
   * and issues a client key scoped to it. Avoids repeating this boilerplate in every test.
   */
  async function setup(app: Awaited<ReturnType<typeof buildServer>>) {
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey)
    const adminKey = await createAdminKey(app, rootKey, project.id)

    const envsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/environments`,
      headers: { authorization: adminKey },
    })
    const envs = envsRes.json<Array<{ id: string; slug: string }>>()
    const prodEnv = envs.find((e) => e.slug === 'production')!
    const clientKey = await createClientKey(app, adminKey, project.id, prodEnv.id)

    return { rootKey, project, adminKey, prodEnv, clientKey }
  }

  it('setFlagEnabled invalidates cached disabled state', async () => {
    const app = await buildServer({ db })
    const { project, adminKey, clientKey } = await setup(app)

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'My Feature', key: 'my-feature' },
    })

    // Populate cache with disabled state
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features/my-feature',
      headers: { authorization: clientKey },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ enabled: false })

    // Enable the flag via the admin route -- this must invalidate the cache
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/my-feature/environments/production/enable`,
      headers: { authorization: adminKey },
    })

    // Cache must be gone; fresh DB read must reflect enabled=true
    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features/my-feature',
      headers: { authorization: clientKey },
    })
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({ enabled: true })

    await app.close()
  })

  it('TTL expiry causes a fresh DB read after stale cache entry expires', async () => {
    /**
     * We use a 1-second TTL so the test can verify that a stale cache entry is
     * discarded after expiry without making the suite prohibitively slow.
     * The 1100 ms sleep is intentional -- BentoCache needs the full TTL window
     * to elapse before it discards the entry.
     */
    const shortCache = createCache(1)
    const app = await buildServer({ db, cache: shortCache })
    const { project, adminKey, prodEnv, clientKey } = await setup(app)

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'TTL Flag', key: 'ttl-flag' },
    })

    // Enable via admin so the flag is on in the DB and the cache entry is warm with enabled=true
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/ttl-flag/environments/production/enable`,
      headers: { authorization: adminKey },
    })

    // Confirm the cache is populated with enabled=true
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features/ttl-flag',
      headers: { authorization: clientKey },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ enabled: true })

    // Write enabled=false directly to the DB, bypassing the service layer so
    // no cache invalidation fires -- the cache still holds the stale true value
    const [flag] = await db!
      .select()
      .from(featureFlags)
      .where(and(eq(featureFlags.projectId, project.id), eq(featureFlags.key, 'ttl-flag')))
      .limit(1)

    await db!
      .update(flagEnvironments)
      .set({ enabled: false })
      .where(
        and(eq(flagEnvironments.flagId, flag.id), eq(flagEnvironments.environmentId, prodEnv.id)),
      )

    // The stale cache entry should still serve enabled=true
    const stale = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features/ttl-flag',
      headers: { authorization: clientKey },
    })
    expect(stale.statusCode).toBe(200)
    expect(stale.json()).toMatchObject({ enabled: true })

    // Wait for the 1-second TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100))

    // After TTL expiry the cache misses and the DB value (disabled) is returned
    const fresh = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features/ttl-flag',
      headers: { authorization: clientKey },
    })
    expect(fresh.statusCode).toBe(200)
    expect(fresh.json()).toMatchObject({ enabled: false })

    await app.close()
  })
})
