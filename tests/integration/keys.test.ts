import { beforeEach, describe, expect, it } from 'vitest'
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

  async function getEnvironmentId(
    app: Awaited<ReturnType<typeof buildServer>>,
    rootKey: string,
    projectId: string,
    slug: string,
  ): Promise<string> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/projects/${projectId}/environments`,
      headers: { authorization: rootKey },
    })
    const envs = res.json<Array<{ id: string; slug: string }>>()
    return envs.find((e) => e.slug === slug)!.id
  }

  describe('POST /api/admin/projects/:projectId/keys', () => {
    it('creates an admin key successfully and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin', description: 'My admin key' },
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
      expect(body.type).toBe('admin')
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
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin' },
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
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin' },
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
      const stagingId = await getEnvironmentId(app, rootKey, project.id, 'staging')

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'client', environmentId: stagingId, description: 'Staging client' },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json<{ type: string; environmentId: string }>()
      expect(body.type).toBe('client')
      expect(body.environmentId).toBe(stagingId)
      await app.close()
    })

    it('returns 400 when type is client but environmentId is not provided', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'client' },
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
      const stagingId = await getEnvironmentId(app, rootKey, project.id, 'staging')

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin', environmentId: stagingId },
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
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'client', environmentId: '00000000-0000-0000-0000-000000000000' },
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
        url: `/api/admin/projects/${project.id}/keys`,
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

  describe('GET /api/admin/projects/:projectId/keys', () => {
    it('returns an empty array when no project-scoped keys have been created', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
      await app.close()
    })

    it('returns created admin and client keys for the project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const stagingId = await getEnvironmentId(app, rootKey, project.id, 'staging')

      const adminKey = await createAdminKey(app, rootKey, project.id)
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKey },
        payload: { type: 'client', environmentId: stagingId, description: 'Staging client' },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      const keys = res.json<Array<{ type: string; environmentId: string | null }>>()
      expect(keys.length).toBe(2)
      expect(keys.some((k) => k.type === 'admin')).toBe(true)
      expect(keys.some((k) => k.type === 'client')).toBe(true)
      await app.close()
    })

    it('does not include the plaintext key field in list response -- only prefix', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      const keys = res.json<Array<Record<string, unknown>>>()
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
      const stagingId = await getEnvironmentId(app, rootKey, project.id, 'staging')

      /**
       * Create an admin key then a client key -- order should be preserved
       */
      const adminKeyStr = await createAdminKey(app, rootKey, project.id)
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: adminKeyStr },
        payload: { type: 'client', environmentId: stagingId },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })

      expect(res.statusCode).toBe(200)
      const keys = res.json<Array<{ createdAt: string }>>()
      const timestamps = keys.map((k) => new Date(k.createdAt).getTime())
      const sorted = [...timestamps].sort((a, b) => a - b)
      expect(timestamps).toEqual(sorted)
      await app.close()
    })
  })

  describe('DELETE /api/admin/projects/:projectId/keys/:keyId', () => {
    it('deletes a key and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      await createAdminKey(app, rootKey, project.id)

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const keys = listRes.json<Array<{ id: string }>>()
      const target = keys[0]

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}/keys/${target.id}`,
        headers: { authorization: rootKey },
      })

      expect(deleteRes.statusCode).toBe(204)

      const afterList = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const remaining = afterList.json<Array<{ id: string }>>()
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
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
      })
      const keys = listRes.json<Array<{ id: string }>>()
      const target = keys[0]

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}/keys/${target.id}`,
        headers: { authorization: rootKey },
      })

      /**
       * The deleted admin key should now be rejected
       */
      const afterDelete = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/keys`,
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
        url: `/api/admin/projects/${project.id}/keys/00000000-0000-0000-0000-000000000000`,
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
