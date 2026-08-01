import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('flags', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  describe('POST /api/v1/admin/projects/:projectId/flags', () => {
    it('creates a flag successfully and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'My Flag', key: 'my-flag', description: 'A test flag' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toMatchObject({
        projectId: project.id,
        name: 'My Flag',
        key: 'my-flag',
        description: 'A test flag',
      })
      const body = response.json<Record<string, unknown>>()
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('createdAt')
      expect(body).toHaveProperty('updatedAt')
      await app.close()
    })

    it('returns 409 on duplicate key within the same project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Flag One', key: 'duplicate-key' },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Flag Two', key: 'duplicate-key' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({
        error: 'Conflict',
        statusCode: 409,
      })
      await app.close()
    })

    it('allows the same key in a different project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-a')
      const projectB = await createProject(app, rootKey, 'project-b')
      const adminKeyA = await createAdminKey(app, rootKey, projectA.id)
      const adminKeyB = await createAdminKey(app, rootKey, projectB.id)

      const responseA = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${projectA.id}/flags`,
        headers: { authorization: adminKeyA },
        payload: { name: 'Shared Key Flag', key: 'shared-key' },
      })
      const responseB = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${projectB.id}/flags`,
        headers: { authorization: adminKeyB },
        payload: { name: 'Shared Key Flag', key: 'shared-key' },
      })

      expect(responseA.statusCode).toBe(201)
      expect(responseB.statusCode).toBe(201)
      await app.close()
    })

    it('returns 400 when name is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { key: 'no-name-flag' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 400 when key is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'No Key Flag' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })
  })

  describe('GET /api/v1/admin/projects/:projectId/flags', () => {
    it('returns an empty array when no flags exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
      await app.close()
    })

    it('returns all flags after creation', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Alpha', key: 'alpha' },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Beta', key: 'beta' },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      const flags = response.json<Array<{ key: string }>>()
      expect(flags).toHaveLength(2)
      expect(flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'alpha' }),
          expect.objectContaining({ key: 'beta' }),
        ]),
      )
      await app.close()
    })

    it('returns flags ordered by createdAt ascending', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'First', key: 'first' },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Second', key: 'second' },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Third', key: 'third' },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      const flags = response.json<Array<{ key: string }>>()
      expect(flags).toHaveLength(3)
      const keys = flags.map((f) => f.key)
      expect(keys).toEqual(['first', 'second', 'third'])
      await app.close()
    })
  })

  describe('GET /api/v1/admin/projects/:projectId/flags/:flagKey', () => {
    it('returns flag by key', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Checkout', key: 'checkout', description: 'Checkout flow flag' },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags/checkout`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        projectId: project.id,
        name: 'Checkout',
        key: 'checkout',
        description: 'Checkout flow flag',
      })
      await app.close()
    })

    it('returns 404 for a non-existent flagKey', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags/does-not-exist`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })
  })

  describe('PATCH /api/v1/admin/projects/:projectId/flags/:flagKey', () => {
    it('updates name successfully and returns 200 with updated flag', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Original Name', key: 'my-flag' },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${project.id}/flags/my-flag`,
        headers: { authorization: adminKey },
        payload: { name: 'Updated Name' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        name: 'Updated Name',
        key: 'my-flag',
        projectId: project.id,
      })
      await app.close()
    })

    it('updates description successfully', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Feature Toggle', key: 'feature-toggle' },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${project.id}/flags/feature-toggle`,
        headers: { authorization: adminKey },
        payload: { description: 'Now with a description' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        key: 'feature-toggle',
        description: 'Now with a description',
      })
      await app.close()
    })

    it('returns 404 for a non-existent flagKey', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${project.id}/flags/ghost-flag`,
        headers: { authorization: adminKey },
        payload: { name: 'Irrelevant' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })

    it('returns 400 when body is empty (no fields provided)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Patch Target', key: 'patch-target' },
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${project.id}/flags/patch-target`,
        headers: { authorization: adminKey },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })
  })

  describe('DELETE /api/v1/admin/projects/:projectId/flags/:flagKey', () => {
    it('deletes a flag and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'To Delete', key: 'to-delete' },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/flags/to-delete`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(204)
      await app.close()
    })

    it('subsequent GET returns 404 after deletion', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Ephemeral', key: 'ephemeral' },
      })
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/flags/ephemeral`,
        headers: { authorization: adminKey },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags/ephemeral`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(404)
      await app.close()
    })

    it('returns 404 for a non-existent flagKey', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/projects/${project.id}/flags/nonexistent-flag`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })
  })

  describe('enable/disable flag per environment', () => {
    it('enables flag in production, returns 200 with enabled: true', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'New Feature', key: 'new-feature' },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/new-feature/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<Record<string, unknown>>()
      expect(body).toMatchObject({ enabled: true })
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('flagId')
      expect(body).toHaveProperty('environmentId')
      expect(body).toHaveProperty('updatedAt')
      await app.close()
    })

    it('disables flag in production, returns 200 with enabled: false', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Toggle Me', key: 'toggle-me' },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/toggle-me/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/toggle-me/environments/production/disable`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ enabled: false })
      await app.close()
    })

    it('enable is idempotent (calling twice both succeed)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Idempotent Enable', key: 'idempotent-enable' },
      })

      const first = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/idempotent-enable/environments/production/enable`,
        headers: { authorization: adminKey },
      })
      const second = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/idempotent-enable/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      expect(first.json()).toMatchObject({ enabled: true })
      expect(second.json()).toMatchObject({ enabled: true })
      await app.close()
    })

    it('disable is idempotent (calling twice both succeed)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Idempotent Disable', key: 'idempotent-disable' },
      })

      const first = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/idempotent-disable/environments/production/disable`,
        headers: { authorization: adminKey },
      })
      const second = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/idempotent-disable/environments/production/disable`,
        headers: { authorization: adminKey },
      })

      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      expect(first.json()).toMatchObject({ enabled: false })
      expect(second.json()).toMatchObject({ enabled: false })
      await app.close()
    })

    it('returns 404 when enabling a non-existent flagKey', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/ghost/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })

    it('returns 404 for a non-existent environmentSlug', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Env Test Flag', key: 'env-test-flag' },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/env-test-flag/environments/nonexistent/enable`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })
  })

  describe('project flag defaults', () => {
    async function setup() {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      return { app, project, adminKey }
    }

    async function setDefaults(
      app: Awaited<ReturnType<typeof buildServer>>,
      projectId: string,
      adminKey: string,
      flagDefaults: Record<string, unknown>,
    ) {
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${projectId}`,
        headers: { authorization: adminKey },
        payload: { settings: { flagDefaults } },
      })
    }

    it('rejects a flag with no description when requireDescription is enabled', async () => {
      const { app, project, adminKey } = await setup()
      await setDefaults(app, project.id, adminKey, { requireDescription: true })

      const missing = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'No Desc', key: 'no-desc' },
      })
      expect(missing.statusCode).toBe(400)

      const withDesc = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Has Desc', key: 'has-desc', description: 'ships the thing' },
      })
      expect(withDesc.statusCode).toBe(201)
      await app.close()
    })

    it('applies defaultState "on" to every environment of a new flag', async () => {
      const { app, project, adminKey } = await setup()
      await setDefaults(app, project.id, adminKey, { defaultState: 'on' })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'On Flag', key: 'on-flag' },
      })
      expect(response.statusCode).toBe(201)
      const state = response.json<{ state: Record<string, { on: boolean }> }>().state
      expect(state.development.on).toBe(true)
      expect(state.production.on).toBe(true)
      await app.close()
    })

    it('applies defaultState "dev" only to the development environment', async () => {
      const { app, project, adminKey } = await setup()
      await setDefaults(app, project.id, adminKey, { defaultState: 'dev' })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Dev Flag', key: 'dev-flag' },
      })
      const state = response.json<{ state: Record<string, { on: boolean }> }>().state
      expect(state.development.on).toBe(true)
      expect(state.production.on).toBe(false)
      await app.close()
    })

    it('defaults new flags to off everywhere when no default is set', async () => {
      const { app, project, adminKey } = await setup()

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { name: 'Plain Flag', key: 'plain-flag' },
      })
      const state = response.json<{ state: Record<string, { on: boolean }> }>().state
      expect(state.development.on).toBe(false)
      expect(state.production.on).toBe(false)
      await app.close()
    })
  })
})
