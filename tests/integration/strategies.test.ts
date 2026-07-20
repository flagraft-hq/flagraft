import type { LightMyRequestResponse } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

interface StrategyResponse {
  id: string
  position: number
  constraints: { fieldKey: string; operator: string; values: string[] }[]
}

describeIfDb('targeting strategies', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /** Project + admin key + a flag + two context fields (tenant string, plan enum). */
  async function setup() {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'strat-project')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    const auth = { authorization: adminKey }

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      headers: auth,
      payload: { key: 'lobby', name: 'Lobby' },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/context-fields`,
      headers: auth,
      payload: { key: 'tenant', type: 'string' },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/context-fields`,
      headers: auth,
      payload: { key: 'plan', type: 'enum', enumValues: ['free', 'pro'] },
    })

    const url = `/api/v1/admin/projects/${project.id}/flags/lobby/environments/production/strategies`
    const put = (body: object): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'PUT', url, headers: auth, payload: body })
    const get = (): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'GET', url, headers: auth })
    return { app, project, auth, url, put, get }
  }

  it('replaces and lists strategies in order', async () => {
    const { app, put, get } = await setup()

    const res = await put({
      strategies: [
        { constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg'] }] },
        { constraints: [{ fieldKey: 'plan', operator: 'equals', values: ['pro'] }] },
      ],
    })
    expect(res.statusCode).toBe(200)

    const list = await get()
    expect(list.statusCode).toBe(200)
    const rows = list.json<StrategyResponse[]>()
    expect(rows).toHaveLength(2)
    expect(rows[0].position).toBe(0)
    expect(rows[0].constraints[0]).toMatchObject({ fieldKey: 'tenant', operator: 'in' })
    expect(rows[1].constraints[0]).toMatchObject({ fieldKey: 'plan', operator: 'equals' })

    await app.close()
  })

  it('a second PUT replaces the previous list', async () => {
    const { app, put, get } = await setup()
    await put({ strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['a'] }] }] })
    await put({ strategies: [{ constraints: [{ fieldKey: 'plan', operator: 'equals', values: ['free'] }] }] })
    const rows = (await get()).json<StrategyResponse[]>()
    expect(rows).toHaveLength(1)
    expect(rows[0].constraints[0].fieldKey).toBe('plan')
    await app.close()
  })

  it('PUT with empty list clears strategies', async () => {
    const { app, put, get } = await setup()
    await put({ strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['a'] }] }] })
    await put({ strategies: [] })
    expect((await get()).json<StrategyResponse[]>()).toHaveLength(0)
    await app.close()
  })

  it('rejects an unknown context field with 400', async () => {
    const { app, put } = await setup()
    const res = await put({
      strategies: [{ constraints: [{ fieldKey: 'nope', operator: 'in', values: ['x'] }] }],
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('rejects an operator not valid for the field type with 400', async () => {
    const { app, put } = await setup()
    // 'before' is a date operator, not valid for a string field
    const res = await put({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'before', values: ['x'] }] }],
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('rejects an enum value outside the allowed set with 400', async () => {
    const { app, put } = await setup()
    const res = await put({
      strategies: [{ constraints: [{ fieldKey: 'plan', operator: 'equals', values: ['gold'] }] }],
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 for an unknown flag', async () => {
    const { app, project, auth } = await setup()
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/flags/ghost/environments/production/strategies`,
      headers: auth,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
