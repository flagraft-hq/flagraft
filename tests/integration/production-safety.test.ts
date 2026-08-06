import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { apiKeys } from '../../src/db/schema.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

type App = Awaited<ReturnType<typeof buildServer>>

describeIfDb('production safety settings', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  async function createFlag(app: App, rootKey: string, projectId: string, key: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${projectId}/flags`,
      headers: { authorization: rootKey },
      payload: { name: key, key },
    })
    expect(res.statusCode).toBe(201)
  }

  async function environmentId(app: App, rootKey: string, projectId: string, slug: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/environments`,
      headers: { authorization: rootKey },
    })
    const found = res.json<{ id: string; slug: string }[]>().find((e) => e.slug === slug)
    expect(found).toBeDefined()
    return found!.id
  }

  async function requireApprovalInProd(app: App, rootKey: string, projectId: string) {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${projectId}`,
      headers: { authorization: rootKey },
      payload: { settings: { security: { requireApprovalInProd: true } } },
    })
    expect(res.statusCode).toBe(200)
  }

  function toggle(
    app: App,
    projectId: string,
    key: string,
    env: string,
    enabled: boolean,
    auth: string,
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${projectId}/flags/${key}/environments/${env}/${enabled ? 'enable' : 'disable'}`,
      headers: { authorization: auth },
    })
  }

  async function getFlag(app: App, projectId: string, key: string, auth: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/flags/${key}`,
      headers: { authorization: auth },
    })
    expect(res.statusCode).toBe(200)
    return res.json<{ state: Record<string, { on: boolean; pending?: unknown }> }>()
  }

  describe('require approval in prod', () => {
    it('a lone admin key toggling production is held pending, not applied', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'approval-lone')
      await requireApprovalInProd(app, rootKey, project.id)
      await createFlag(app, rootKey, project.id, 'lone.flag')
      const keyA = await createAdminKey(app, rootKey, project.id)

      const res = await toggle(app, project.id, 'lone.flag', 'production', true, keyA)
      expect(res.statusCode).toBe(202)
      expect(res.json()).toMatchObject({ pending: true, requestedEnabled: true })

      const flag = await getFlag(app, project.id, 'lone.flag', rootKey)
      expect(flag.state.production).toMatchObject({
        on: false,
        pending: { requestedEnabled: true },
      })
      await app.close()
    })

    it('the same admin key repeating the request stays pending', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'approval-repeat')
      await requireApprovalInProd(app, rootKey, project.id)
      await createFlag(app, rootKey, project.id, 'repeat.flag')
      const keyA = await createAdminKey(app, rootKey, project.id)

      await toggle(app, project.id, 'repeat.flag', 'production', true, keyA)
      const repeat = await toggle(app, project.id, 'repeat.flag', 'production', true, keyA)
      expect(repeat.statusCode).toBe(202)

      const flag = await getFlag(app, project.id, 'repeat.flag', rootKey)
      expect(flag.state.production.on).toBe(false)
      await app.close()
    })

    it('a second, distinct admin key confirming the same change applies it', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'approval-confirm')
      await requireApprovalInProd(app, rootKey, project.id)
      await createFlag(app, rootKey, project.id, 'confirm.flag')
      const keyA = await createAdminKey(app, rootKey, project.id)
      const keyB = await createAdminKey(app, rootKey, project.id)

      const first = await toggle(app, project.id, 'confirm.flag', 'production', true, keyA)
      expect(first.statusCode).toBe(202)

      const second = await toggle(app, project.id, 'confirm.flag', 'production', true, keyB)
      expect(second.statusCode).toBe(200)
      expect(second.json<{ enabled: boolean }>().enabled).toBe(true)

      const flag = await getFlag(app, project.id, 'confirm.flag', rootKey)
      expect(flag.state.production).toEqual({ on: true })
      await app.close()
    })

    it('a distinct admin requesting the opposite direction supersedes the pending request', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'approval-supersede')
      await requireApprovalInProd(app, rootKey, project.id)
      await createFlag(app, rootKey, project.id, 'supersede.flag')
      const keyA = await createAdminKey(app, rootKey, project.id)
      const keyB = await createAdminKey(app, rootKey, project.id)

      const request1 = await toggle(app, project.id, 'supersede.flag', 'production', true, keyA)
      expect(request1.statusCode).toBe(202)

      /** keyB wants the opposite direction -- this replaces keyA's request, not confirms it. */
      const request2 = await toggle(app, project.id, 'supersede.flag', 'production', false, keyB)
      expect(request2.statusCode).toBe(202)
      expect(request2.json()).toMatchObject({ pending: true, requestedEnabled: false })

      /** keyA now confirms the new (disable) direction, which keyB started. */
      const confirm = await toggle(app, project.id, 'supersede.flag', 'production', false, keyA)
      expect(confirm.statusCode).toBe(200)

      const flag = await getFlag(app, project.id, 'supersede.flag', rootKey)
      expect(flag.state.production).toEqual({ on: false })
      await app.close()
    })

    it('is not required in development, and does not apply when the project setting is off', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'approval-off')
      await requireApprovalInProd(app, rootKey, project.id)
      await createFlag(app, rootKey, project.id, 'off.flag')
      const keyA = await createAdminKey(app, rootKey, project.id)

      /** Development isn't protected, so approval never applies there. */
      const dev = await toggle(app, project.id, 'off.flag', 'development', true, keyA)
      expect(dev.statusCode).toBe(200)

      /** With the setting off, production behaves exactly as before this feature. */
      const otherProject = await createProject(app, rootKey, 'approval-untouched')
      await createFlag(app, rootKey, otherProject.id, 'untouched.flag')
      const untouchedKey = await createAdminKey(app, rootKey, otherProject.id)
      const prod = await toggle(
        app,
        otherProject.id,
        'untouched.flag',
        'production',
        true,
        untouchedKey,
      )
      expect(prod.statusCode).toBe(200)
      await app.close()
    })
  })

  describe('key TTL', () => {
    it('a project TTL sets expiresAt on new admin keys but not client keys', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'ttl-proj')

      const setTtl = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
        payload: { settings: { security: { keyTtlDays: 30 } } },
      })
      expect(setTtl.statusCode).toBe(200)

      const adminIssue = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin', description: 'ttl-admin' },
      })
      expect(adminIssue.statusCode).toBe(201)
      const admin = adminIssue.json<{ expiresAt: string | null }>()
      expect(admin.expiresAt).not.toBeNull()
      const expectedMs = Date.now() + 30 * 24 * 60 * 60 * 1000
      expect(Math.abs(new Date(admin.expiresAt!).getTime() - expectedMs)).toBeLessThan(10_000)

      const devEnvId = await environmentId(app, rootKey, project.id, 'development')
      const clientIssue = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'client', environmentId: devEnvId, description: 'ttl-client' },
      })
      expect(clientIssue.statusCode).toBe(201)
      expect(clientIssue.json<{ expiresAt: string | null }>().expiresAt).toBeNull()
      await app.close()
    })

    it('an admin key never expires when the project has no TTL configured', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'no-ttl-proj')

      const issue = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin', description: 'no-ttl' },
      })
      expect(issue.statusCode).toBe(201)
      expect(issue.json<{ expiresAt: string | null }>().expiresAt).toBeNull()
      await app.close()
    })

    it('an expired admin key is rejected', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'expired-proj')

      const issue = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/keys`,
        headers: { authorization: rootKey },
        payload: { type: 'admin', description: 'expiring' },
      })
      const { key: plaintext, prefix } = issue.json<{ key: string; prefix: string }>()

      /** Simulate the key's TTL having passed instead of waiting for real time. */
      await db!
        .update(apiKeys)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(apiKeys.keyPrefix, prefix))

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/projects/${project.id}/flags`,
        headers: { authorization: plaintext },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json<{ message: string }>().message).toMatch(/expired/i)
      await app.close()
    })
  })
})
