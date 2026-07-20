import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

interface ContextFieldResponse {
  id: string
  key: string
  type: string
  source: string
  required: boolean
  description: string | null
  example: string | null
  enumValues: string[] | null
}

describeIfDb('context-fields', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /** Builds a server with a project and its admin key ready to use. */
  async function setup() {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'ctx-project')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    return { app, adminKey, projectId: project.id }
  }

  function create(
    app: Awaited<ReturnType<typeof buildServer>>,
    adminKey: string,
    projectId: string,
    payload: Record<string, unknown>,
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${projectId}/context-fields`,
      headers: { authorization: adminKey },
      payload,
    })
  }

  it('creates, lists, updates, and deletes a context field', async () => {
    const { app, adminKey, projectId } = await setup()

    const created = await create(app, adminKey, projectId, {
      key: 'plan',
      type: 'enum',
      source: 'sdk',
      required: true,
      description: 'Subscription tier',
      example: 'pro',
      enumValues: ['free', 'pro'],
    })
    expect(created.statusCode).toBe(201)
    const field = created.json<ContextFieldResponse>()
    expect(field).toMatchObject({
      key: 'plan',
      type: 'enum',
      source: 'sdk',
      required: true,
      description: 'Subscription tier',
      example: 'pro',
      enumValues: ['free', 'pro'],
    })
    expect(typeof field.id).toBe('string')

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/context-fields`,
      headers: { authorization: adminKey },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json<ContextFieldResponse[]>()).toHaveLength(1)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${projectId}/context-fields/${field.id}`,
      headers: { authorization: adminKey },
      payload: { type: 'string', source: 'server', required: false, description: 'Now a string' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json<ContextFieldResponse>()).toMatchObject({
      key: 'plan',
      type: 'string',
      source: 'server',
      required: false,
      description: 'Now a string',
      enumValues: null,
    })

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${projectId}/context-fields/${field.id}`,
      headers: { authorization: adminKey },
    })
    expect(deleted.statusCode).toBe(204)

    const listAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/context-fields`,
      headers: { authorization: adminKey },
    })
    expect(listAfter.json<ContextFieldResponse[]>()).toHaveLength(0)

    await app.close()
  })

  it('returns 409 on a duplicate key within a project', async () => {
    const { app, adminKey, projectId } = await setup()
    const first = await create(app, adminKey, projectId, { key: 'country' })
    expect(first.statusCode).toBe(201)
    const dup = await create(app, adminKey, projectId, { key: 'country' })
    expect(dup.statusCode).toBe(409)
    await app.close()
  })

  it('PATCH cannot change the key', async () => {
    const { app, adminKey, projectId } = await setup()
    const created = await create(app, adminKey, projectId, { key: 'region' })
    const field = created.json<ContextFieldResponse>()

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${projectId}/context-fields/${field.id}`,
      headers: { authorization: adminKey },
      payload: { key: 'renamed', type: 'number' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json<ContextFieldResponse>().key).toBe('region')
    await app.close()
  })

  it('returns 400 when enum type is missing enumValues', async () => {
    const { app, adminKey, projectId } = await setup()
    const res = await create(app, adminKey, projectId, { key: 'tier', type: 'enum' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('isolates fields per project: same key allowed in two projects, list is scoped', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const projectA = await createProject(app, rootKey, 'project-a')
    const projectB = await createProject(app, rootKey, 'project-b')
    const adminA = await createAdminKey(app, rootKey, projectA.id)
    const adminB = await createAdminKey(app, rootKey, projectB.id)

    expect((await create(app, adminA, projectA.id, { key: 'shared' })).statusCode).toBe(201)
    expect((await create(app, adminB, projectB.id, { key: 'shared' })).statusCode).toBe(201)

    const listA = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectA.id}/context-fields`,
      headers: { authorization: adminA },
    })
    expect(listA.json<ContextFieldResponse[]>()).toHaveLength(1)
    await app.close()
  })
})
