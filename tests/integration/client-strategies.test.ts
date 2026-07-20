import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createClientKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('client evaluation with strategies', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /** Project + a lobby flag enabled in production + a `tenant` field + a prod client key. */
  async function setup() {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'eval-project')
    const adminKey = await createAdminKey(app, rootKey, project.id)
    const auth = { authorization: adminKey }

    const envRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/environments`,
      headers: auth,
    })
    const prod = envRes.json<{ id: string; slug: string }[]>().find((e) => e.slug === 'production')!

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      headers: auth,
      payload: { key: 'lobby', name: 'Lobby' },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/lobby/environments/production/enable`,
      headers: auth,
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/context-fields`,
      headers: auth,
      payload: { key: 'tenant', type: 'string' },
    })
    const clientKey = await createClientKey(app, adminKey, project.id, prod.id)

    async function putStrategies(body: object) {
      return app.inject({
        method: 'PUT',
        url: `/api/v1/admin/projects/${project.id}/flags/lobby/environments/production/strategies`,
        headers: auth,
        payload: body,
      })
    }
    function evalLobby(query = '') {
      return app.inject({
        method: 'GET',
        url: `/api/v1/client/features/lobby${query}`,
        headers: { authorization: clientKey },
      })
    }
    async function disableLobby() {
      return app.inject({
        method: 'POST',
        url: `/api/v1/admin/projects/${project.id}/flags/lobby/environments/production/disable`,
        headers: auth,
      })
    }
    return { app, putStrategies, evalLobby, disableLobby, clientKey }
  }

  it('enabled with no strategies is on for everyone (reason default)', async () => {
    const { app, evalLobby } = await setup()
    expect((await evalLobby()).json()).toMatchObject({ enabled: true, reason: 'default' })
    await app.close()
  })

  it('strategy tenant IN [phyg]: only phyg is on', async () => {
    const { app, putStrategies, evalLobby } = await setup()
    await putStrategies({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg'] }] }],
    })

    expect((await evalLobby('?tenant=phyg')).json()).toMatchObject({
      enabled: true,
      reason: 'strategy-match',
    })
    expect((await evalLobby('?tenant=acme')).json()).toMatchObject({
      enabled: false,
      reason: 'default',
    })
    expect((await evalLobby()).json()).toMatchObject({ enabled: false, reason: 'default' })
    await app.close()
  })

  it('disabling the flag overrides strategies (reason disabled)', async () => {
    const { app, putStrategies, evalLobby, disableLobby } = await setup()
    await putStrategies({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg'] }] }],
    })
    // matches while enabled
    expect((await evalLobby('?tenant=phyg')).json()).toMatchObject({ enabled: true })
    // disabling the environment forces off regardless of strategies
    await disableLobby()
    expect((await evalLobby('?tenant=phyg')).json()).toMatchObject({
      enabled: false,
      reason: 'disabled',
    })
    await app.close()
  })

  it('bulk /client/features reflects strategy matches', async () => {
    const { app, putStrategies, clientKey } = await setup()
    await putStrategies({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg'] }] }],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/client/features?tenant=phyg',
      headers: { authorization: clientKey },
    })
    const features = res.json<{ features: { name: string; enabled: boolean }[] }>().features
    expect(features.find((f) => f.name === 'lobby')?.enabled).toBe(true)
    await app.close()
  })
})
