import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { environments } from '../../src/db/schema.js'
import { createAdminKey, createClientKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('phase 1 integration', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  it('supports the full happy path and environment-specific evaluation', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey)
    const adminKey = await createAdminKey(app, rootKey, project.id)

    const envs = await db!.select().from(environments).where(eq(environments.projectId, project.id))
    expect(envs.map((environment) => environment.slug).sort()).toEqual([
      'development',
      'production',
      'staging'
    ])

    await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'Checkout', key: 'checkout' }
    })
    await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags/checkout/environments/staging/enable`,
      headers: { authorization: adminKey }
    })

    const staging = envs.find((environment) => environment.slug === 'staging')!
    const production = envs.find((environment) => environment.slug === 'production')!
    const stagingClient = await createClientKey(app, adminKey, project.id, staging.id)
    const productionClient = await createClientKey(app, adminKey, project.id, production.id)

    const stagingResponse = await app.inject({
      method: 'GET',
      url: '/api/client/features/checkout',
      headers: { authorization: stagingClient }
    })
    const productionResponse = await app.inject({
      method: 'GET',
      url: '/api/client/features/checkout',
      headers: { authorization: productionClient }
    })

    expect(stagingResponse.json()).toMatchObject({ name: 'checkout', enabled: true })
    expect(productionResponse.json()).toMatchObject({ name: 'checkout', enabled: false })
    await app.close()
  })

  it('evaluates overrides before defaults', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey)
    const adminKey = await createAdminKey(app, rootKey, project.id)
    const [staging] = await db!
      .select()
      .from(environments)
      .where(eq(environments.projectId, project.id))
      .limit(1)
    const clientKey = await createClientKey(app, adminKey, project.id, staging.id)

    await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'Checkout', key: 'checkout' }
    })
    await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags/checkout/environments/${staging.slug}/overrides`,
      headers: { authorization: adminKey },
      payload: { contextKey: 'userId', contextValue: 'user_abc123', enabled: true }
    })

    const match = await app.inject({
      method: 'GET',
      url: '/api/client/features/checkout?userId=user_abc123',
      headers: { authorization: clientKey }
    })
    const miss = await app.inject({
      method: 'GET',
      url: '/api/client/features/checkout?userId=other',
      headers: { authorization: clientKey }
    })

    expect(match.json()).toMatchObject({ enabled: true, reason: 'override' })
    expect(miss.json()).toMatchObject({ enabled: false, reason: 'default' })
    await app.close()
  })

  it('enforces auth scopes', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'a')
    const other = await createProject(app, rootKey, 'b')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    const [environment] = await db!
      .select()
      .from(environments)
      .where(eq(environments.projectId, project.id))
      .limit(1)
    const clientKey = await createClientKey(app, adminKey, project.id, environment.id)

    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/admin/projects/${project.id}/flags`,
          headers: { authorization: clientKey }
        })
      ).statusCode
    ).toBe(403)

    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/admin/projects/${other.id}`,
          headers: { authorization: adminKey }
        })
      ).statusCode
    ).toBe(403)

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/admin/projects',
          headers: { authorization: adminKey },
          payload: { name: 'Nope', slug: 'nope' }
        })
      ).statusCode
    ).toBe(403)
    await app.close()
  })

  it('returns conflicts for duplicate resources', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey)
    const adminKey = await createAdminKey(app, rootKey, project.id)

    const duplicateProject = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { authorization: rootKey },
      payload: { name: 'Duplicate', slug: project.slug }
    })
    expect(duplicateProject.statusCode).toBe(409)

    await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'Checkout', key: 'checkout' }
    })
    const duplicateFlag = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${project.id}/flags`,
      headers: { authorization: adminKey },
      payload: { name: 'Checkout 2', key: 'checkout' }
    })
    expect(duplicateFlag.statusCode).toBe(409)
    await app.close()
  })

  it('cascades project deletion', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/projects/${project.id}`,
      headers: { authorization: rootKey }
    })

    expect(response.statusCode).toBe(204)
    expect(await db!.select().from(environments).where(eq(environments.projectId, project.id))).toEqual([])
    await app.close()
  })
})
