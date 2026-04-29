import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

/**
 * Helper function to create a feature flag for testing overrides
 */
async function createFlag(
  app: Awaited<ReturnType<typeof buildServer>>,
  adminKey: string,
  projectId: string,
  key = 'test-flag',
) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/projects/${projectId}/flags`,
    headers: { authorization: adminKey },
    payload: { name: 'Test Flag', key },
  })
  return res.json<{ id: string; key: string }>()
}

describeIfDb('overrides', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  describe('POST /overrides', () => {
    it('creates an override with enabled: true and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_001', enabled: true },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json<{
        id: string
        flagId: string
        environmentId: string
        contextKey: string
        contextValue: string
        enabled: boolean
        createdAt: string
      }>()
      expect(body).toMatchObject({
        contextKey: 'userId',
        contextValue: 'user_001',
        enabled: true,
      })
      expect(typeof body.id).toBe('string')
      expect(typeof body.flagId).toBe('string')
      expect(typeof body.environmentId).toBe('string')
      expect(typeof body.createdAt).toBe('string')
      await app.close()
    })

    it('creates an override with enabled: false', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_002', enabled: false },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ enabled: false })
      await app.close()
    })

    it('returns 409 on duplicate (flagKey + envSlug + contextKey + contextValue)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const payload = { contextKey: 'userId', contextValue: 'user_dup', enabled: true }
      const base = `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`

      await app.inject({ method: 'POST', url: base, headers: { authorization: adminKey }, payload })
      const res = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json()).toMatchObject({
        error: 'Conflict',
        statusCode: 409,
      })
      await app.close()
    })

    it('allows same contextKey with different contextValue (no conflict)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const base = `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`

      const first = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_a', enabled: true },
      })
      const second = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_b', enabled: false },
      })

      expect(first.statusCode).toBe(201)
      expect(second.statusCode).toBe(201)
      await app.close()
    })

    it('accepts empty string contextValue', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'plan', contextValue: '', enabled: true },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ contextValue: '' })
      await app.close()
    })

    it('returns 400 when contextKey is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextValue: 'user_001', enabled: true },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 400 when enabled is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_001' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 400 when enabled is a string instead of boolean', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_001', enabled: 'true' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 404 when flagKey does not exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/nonexistent-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_001', enabled: true },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })

    it('returns 404 when environmentSlug does not exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/nonexistent-env/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_001', enabled: true },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })
  })

  describe('GET /overrides', () => {
    it('returns empty array when no overrides exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
      await app.close()
    })

    it('returns all overrides for the flag+env pair after creation', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const base = `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`

      await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_a', enabled: true },
      })
      await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_b', enabled: false },
      })

      const res = await app.inject({
        method: 'GET',
        url: base,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<Array<{ contextKey: string; contextValue: string; enabled: boolean }>>()
      expect(Array.isArray(body)).toBe(true)
      expect(body).toHaveLength(2)
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ contextKey: 'userId', contextValue: 'user_a', enabled: true }),
          expect.objectContaining({ contextKey: 'userId', contextValue: 'user_b', enabled: false }),
        ]),
      )
      await app.close()
    })

    it('only returns overrides for the correct flag', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id, 'flag-a')
      await createFlag(app, adminKey, project.id, 'flag-b')

      const envPath = `/api/v1/admin/projects/${project.id}/flags`

      await app.inject({
        method: 'POST',
        url: `${envPath}/flag-a/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_a', enabled: true },
      })
      await app.inject({
        method: 'POST',
        url: `${envPath}/flag-b/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_b', enabled: false },
      })

      const res = await app.inject({
        method: 'GET',
        url: `${envPath}/flag-a/environments/production/overrides`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<Array<{ contextValue: string }>>()
      expect(body).toHaveLength(1)
      expect(body[0]).toMatchObject({ contextValue: 'user_a' })
      await app.close()
    })
  })

  describe('DELETE /overrides/:overrideId', () => {
    it('deletes an override and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const base = `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`

      const created = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_del', enabled: true },
      })
      const { id } = created.json<{ id: string }>()

      const res = await app.inject({
        method: 'DELETE',
        url: `${base}/${id}`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(204)
      await app.close()
    })

    it('after deletion GET returns empty array', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const base = `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides`

      const created = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'user_gone', enabled: true },
      })
      const { id } = created.json<{ id: string }>()

      await app.inject({
        method: 'DELETE',
        url: `${base}/${id}`,
        headers: { authorization: adminKey },
      })

      const res = await app.inject({
        method: 'GET',
        url: base,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
      await app.close()
    })

    it('returns 404 for a non-existent overrideId', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      await createFlag(app, adminKey, project.id)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/flags/test-flag/environments/production/overrides/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })
  })
})
