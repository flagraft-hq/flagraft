import { beforeEach, describe, expect, it } from 'vitest'

import { API_KEY_TYPES } from '../../src/auth/constants.js'
import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('api keys', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /**
   * Helper function to retrieve the unique ID of an environment by its slug
   */
  async function getEnvironmentId(
    app: Awaited<ReturnType<typeof buildServer>>,
    rootKey: string,
    projectId: string,
    slug: string,
  ): Promise<string> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/environments`,
      headers: { authorization: rootKey },
    })
    const envs = res.json<Array<{ id: string; slug: string }>>()
    return envs.find((e) => e.slug === slug)!.id
  }

  /**
   * Tests for creating various types of API keys
   */
  describe('POST /api/v1/admin/projects/:projectId/keys', () => {
    it('creates an admin key successfully and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.ADMIN, description: 'My admin key' },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json<{
        id: string
        prefix: string
        type: string
        environmentId: null
        key: string
        createdAt: string
      }>()
      expect(body.type).toBe(API_KEY_TYPES.ADMIN)
      expect(body.environmentId).toBeNull()
      expect(typeof body.id).toBe('string')
      expect(typeof body.key).toBe('string')
      expect(typeof body.prefix).toBe('string')
      expect(typeof body.createdAt).toBe('string')
      await app.close()
    })

    it('returned key starts with ff_', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.ADMIN },
      })

      expect(res.statusCode).toBe(201)
      const { key } = res.json<{ key: string }>()
      expect(key.startsWith('ff_')).toBe(true)
      await app.close()
    })

    it('returned prefix equals the first 12 characters of the key', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.ADMIN },
      })

      expect(res.statusCode).toBe(201)
      const { key, prefix } = res.json<{ key: string; prefix: string }>()
      expect(prefix).toBe(key.slice(0, 12))
      await app.close()
    })

    it('creates a client key successfully with environmentId and returns 201', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const productionId = await getEnvironmentId(app, rootKey, project.id, 'production')

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: {
          type: API_KEY_TYPES.CLIENT,
          environmentId: productionId,
          description: 'Production client',
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json<{ type: string; environmentId: string }>()
      expect(body.type).toBe(API_KEY_TYPES.CLIENT)
      expect(body.environmentId).toBe(productionId)
      await app.close()
    })

    it('returns 400 when type is client but environmentId is not provided', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.CLIENT },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'BadRequest',
        message: 'Client keys require environmentId',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 400 when type is admin but environmentId is provided', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const productionId = await getEnvironmentId(app, rootKey, project.id, 'production')

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.ADMIN, environmentId: productionId },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'BadRequest',
        message: 'Admin keys cannot be scoped to an environment',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 404 when environmentId does not exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: {
          type: API_KEY_TYPES.CLIENT,
          environmentId: '00000000-0000-0000-0000-000000000000',
        },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })

    it('returns 400 when type is an invalid value', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'superadmin' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })
  })

  /**
   * Tests for listing API keys within a project
   */
  describe('GET /api/v1/admin/projects/:projectId/keys', () => {
    it('returns an empty array when no project-scoped keys have been created', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ data: [], total: 0, limit: 25, offset: 0 })
      await app.close()
    })

    it('pages through results and reports the unpaged total', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/projects/${project.id}/keys`,
          headers: { authorization: adminKey },
          payload: { type: API_KEY_TYPES.ADMIN, description: `key-${i}` },
        })
      }

      const page = async (offset: number) =>
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/admin/projects/${project.id}/keys?limit=2&offset=${offset}`,
            headers: { authorization: rootKey },
          })
        ).json<{ data: Array<{ id: string }>; total: number }>()

      /** 4 created here plus the admin key used to create them. */
      const first = await page(0)
      expect(first.total).toBe(5)
      expect(first.data).toHaveLength(2)

      const ids = [...first.data, ...(await page(2)).data, ...(await page(4)).data].map((k) => k.id)
      expect(new Set(ids).size).toBe(5)
      expect((await page(99)).data).toEqual([])
      await app.close()
    })

    it('filters by search, scope and environment', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const productionId = await getEnvironmentId(app, rootKey, project.id, 'production')
      const developmentId = await getEnvironmentId(app, rootKey, project.id, 'development')

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKey },
        payload: {
          type: API_KEY_TYPES.CLIENT,
          environmentId: productionId,
          description: 'Checkout web',
        },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKey },
        payload: {
          type: API_KEY_TYPES.CLIENT,
          environmentId: developmentId,
          description: 'Local dev 50% rollout',
        },
      })

      const list = async (query: string) =>
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/admin/projects/${project.id}/keys?${query}`,
            headers: { authorization: rootKey },
          })
        ).json<{ data: Array<{ type: string; description: string | null }>; total: number }>()

      expect((await list('type=client')).total).toBe(2)
      expect((await list(`environmentId=${productionId}`)).total).toBe(1)
      expect((await list('search=checkout')).total).toBe(1)

      /** A bare % must not act as a wildcard matching every row. */
      const percent = await list('search=%25')
      expect(percent.total).toBe(1)
      expect(percent.data[0].description).toBe('Local dev 50% rollout')

      /** The prefix is searchable too, so an admin can paste part of a key. */
      const anyKey = (await list('limit=1')).data[0] as unknown as { prefix?: string }
      expect((await list('type=client&search=checkout')).total).toBe(1)
      expect(anyKey).toBeDefined()
      await app.close()
    })

    it('rejects a page size above the maximum', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys?limit=5000`,
        headers: { authorization: rootKey },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('returns created admin and client keys for the project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const productionId = await getEnvironmentId(app, rootKey, project.id, 'production')

      const adminKey = await createAdminKey(app, rootKey, project.id)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKey },
        payload: {
          type: API_KEY_TYPES.CLIENT,
          environmentId: productionId,
          description: 'Production client',
        },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      const keys = res.json<{ data: Array<{ type: string; environmentId: string | null }> }>().data
      expect(keys.length).toBe(2)
      expect(keys.some((k) => k.type === API_KEY_TYPES.ADMIN)).toBe(true)
      expect(keys.some((k) => k.type === API_KEY_TYPES.CLIENT)).toBe(true)
      await app.close()
    })

    it('does not include the plaintext key field in list response -- only prefix', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      const keys = res.json<{ data: Array<Record<string, unknown>> }>().data
      expect(keys.length).toBeGreaterThan(0)
      for (const k of keys) {
        expect('key' in k).toBe(false)
        expect(typeof k['prefix']).toBe('string')
      }
      await app.close()
    })

    it('returns keys ordered by createdAt ascending', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const productionId = await getEnvironmentId(app, rootKey, project.id, 'production')

      /**
       * Create an admin key then a client key -- order should be preserved
       */
      const adminKeyStr = await createAdminKey(app, rootKey, project.id)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKeyStr },
        payload: { type: API_KEY_TYPES.CLIENT, environmentId: productionId },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      /** Newest first is the default now; the explicit ascending sort still works. */
      const keys = res.json<{ data: Array<{ createdAt: string }> }>().data
      const timestamps = keys.map((k) => new Date(k.createdAt).getTime())
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))

      const ascRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys?sort=created&dir=asc`,
        headers: { authorization: rootKey },
      })
      const ascending = ascRes
        .json<{ data: Array<{ createdAt: string }> }>()
        .data.map((k) => new Date(k.createdAt).getTime())
      expect(ascending).toEqual([...ascending].sort((a, b) => a - b))
      await app.close()
    })
  })

  /**
   * Tests for revoking and deleting API keys
   */
  describe('DELETE /api/v1/admin/projects/:projectId/keys/:keyId', () => {
    it('deletes a key and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      await createAdminKey(app, rootKey, project.id)

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const keys = listRes.json<{ data: Array<{ id: string }> }>().data
      const target = keys[0]

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/keys/${target.id}`,
        headers: { authorization: rootKey },
      })

      expect(deleteRes.statusCode).toBe(204)

      const afterList = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const remaining = afterList.json<{ data: Array<{ id: string }> }>().data
      expect(remaining.find((k) => k.id === target.id)).toBeUndefined()
      await app.close()
    })

    it('prevents the deleted key from being used for auth -- subsequent request returns 401', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const keys = listRes.json<{ data: Array<{ id: string }> }>().data
      const target = keys[0]

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/keys/${target.id}`,
        headers: { authorization: rootKey },
      })

      /**
       * The deleted admin key should now be rejected
       */
      const afterDelete = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKey },
      })

      expect(afterDelete.statusCode).toBe(401)
      await app.close()
    })

    it('returns 404 for a non-existent keyId', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/keys/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })
  })
})
