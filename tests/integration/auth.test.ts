import { beforeEach, describe, expect, it } from 'vitest'

import { API_KEY_TYPES } from '../../src/auth/constants.js'
import { buildServer } from '../../src/server.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('auth', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /**
   * Missing or invalid Authorization header
   */
  describe('missing or invalid Authorization header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const app = await buildServer({ db })

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ error: 'Unauthorized', statusCode: 401 })
      await app.close()
    })

    it('returns 401 when Authorization header contains a valid-looking but non-existent key', async () => {
      const app = await buildServer({ db })

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: 'ff_0000000000000000000000000000000000000000' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ error: 'Unauthorized', statusCode: 401 })
      await app.close()
    })

    it('returns 401 when Authorization header is an empty string', async () => {
      const app = await buildServer({ db })

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: '' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ error: 'Unauthorized', statusCode: 401 })
      await app.close()
    })
  })

  /**
   * Root key requirements
   */
  describe('root key requirements', () => {
    it('root key can call POST /api/admin/projects and receives 201', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
        payload: { name: 'Root Project', slug: 'root-project' },
      })

      expect(response.statusCode).toBe(201)
      await app.close()
    })

    it('project admin key is rejected by POST /api/admin/projects with 403', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'existing-project')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: adminKey },
        payload: { name: 'Sneaky Project', slug: 'sneaky-project' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })

    it('client key is rejected by POST /api/admin/projects with 403', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'client-test-project')

      const envsRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: rootKey },
      })
      const envs = envsRes.json<Array<{ id: string; slug: string }>>()
      const envId = envs[0].id

      const clientKey = await createClientKey(app, rootKey, project.id, envId)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: clientKey },
        payload: { name: 'Client Sneaky', slug: 'client-sneaky' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })

    it('root key can call DELETE /api/admin/projects/:projectId and receives 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'to-delete')

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(204)
      await app.close()
    })

    it('project admin key is rejected by DELETE /api/admin/projects/:projectId with 403', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'admin-cannot-delete')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })
  })

  /**
   * Admin key project scoping
   */
  describe('admin key project scoping', () => {
    it('project admin key can access its own project via GET /api/admin/projects/:projectId', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'my-project')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      await app.close()
    })

    it('project admin key is rejected when accessing a different project route with 403', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-alpha')
      const projectB = await createProject(app, rootKey, 'project-beta')
      const adminKeyA = await createAdminKey(app, rootKey, projectA.id)

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${projectB.id}`,
        headers: { authorization: adminKeyA },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })

    it('root key can access any project via GET /api/admin/projects/:projectId', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-one')
      const projectB = await createProject(app, rootKey, 'project-two')

      const responseA = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${projectA.id}`,
        headers: { authorization: rootKey },
      })
      const responseB = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${projectB.id}`,
        headers: { authorization: rootKey },
      })

      expect(responseA.statusCode).toBe(200)
      expect(responseB.statusCode).toBe(200)
      await app.close()
    })
  })

  /**
   * Client key restrictions
   */
  describe('client key restrictions', () => {
    it('client key is rejected on admin routes with 403', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'client-restricted')

      const envsRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: rootKey },
      })
      const envs = envsRes.json<Array<{ id: string; slug: string }>>()
      const envId = envs[0].id

      const clientKey = await createClientKey(app, rootKey, project.id, envId)

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: clientKey },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })

    it('client key can access GET /api/client/features and receives 200', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'client-features')

      const envsRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: rootKey },
      })
      const envs = envsRes.json<Array<{ id: string; slug: string }>>()
      const envId = envs[0].id

      const clientKey = await createClientKey(app, rootKey, project.id, envId)

      const response = await app.inject({
        method: 'GET',
        url: '/api/client/features',
        headers: { authorization: clientKey },
      })

      expect(response.statusCode).toBe(200)
      await app.close()
    })
  })

  /**
   * Key lifecycle
   */
  describe('key lifecycle', () => {
    it('deleted key returns 401 on subsequent requests', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'lifecycle-project')

      const createRes = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: API_KEY_TYPES.ADMIN, description: 'Temporary key' },
      })
      expect(createRes.statusCode).toBe(201)
      const { key, id: keyId } = createRes.json<{ key: string; id: string }>()

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}/keys/${keyId}`,
        headers: { authorization: rootKey },
      })
      expect(deleteRes.statusCode).toBe(204)

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: key },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ error: 'Unauthorized', statusCode: 401 })
      await app.close()
    })
  })
})
