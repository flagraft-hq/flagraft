import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FlagraftClient, FlagraftError } from '../../packages/sdk-js/src/index.js'
import { buildServer } from '../../src/server.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

type App = Awaited<ReturnType<typeof buildServer>>

/**
 * Drives the real SDK against a real listening server. Every other SDK test
 * mocks the transport, so this is the only place a wire-level change -- a
 * renamed field, a different error envelope, a new reason value, a change in
 * how context is coerced -- can actually fail a build.
 */
describeIfDb('SDK <-> server contract', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  let app: App
  let baseUrl: string
  let clientKey: string
  let adminKey: string

  /** Fresh client per call so the SDK cache never hides a server round trip. */
  function sdk(ttl = 0) {
    return new FlagraftClient({ baseUrl, apiKey: clientKey, ttl })
  }

  async function post(key: string, url: string, payload?: unknown) {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { authorization: key },
      payload: payload as never,
    })
    if (response.statusCode >= 300) throw new Error(`${url} -> ${response.body}`)
    return response
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)

    app = await buildServer({ db, skipBootSeed: true })
    await app.listen({ port: 0, host: '127.0.0.1' })
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`

    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'sdk-contract')
    adminKey = await createAdminKey(app, rootKey, project.id)

    const envsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/environments`,
      headers: { authorization: adminKey },
    })
    const dev = envsResponse
      .json<Array<{ id: string; slug: string }>>()
      .find((e) => e.slug === 'development')!

    for (const field of [
      { key: 'plan', type: 'string' },
      { key: 'seats', type: 'number' },
      { key: 'isBeta', type: 'boolean' },
      { key: 'signupDate', type: 'date' },
      { key: 'appVersion', type: 'version' },
    ]) {
      await post(adminKey, `/api/v1/admin/projects/${project.id}/context-fields`, field)
    }

    for (const key of ['always-on', 'switched-off', 'targeted', 'typed-context']) {
      await post(adminKey, `/api/v1/admin/projects/${project.id}/flags`, { name: key, key })
    }

    const flagBase = `/api/v1/admin/projects/${project.id}/flags`
    for (const key of ['always-on', 'targeted', 'typed-context']) {
      await post(adminKey, `${flagBase}/${key}/environments/${dev.slug}/enable`)
    }

    await app.inject({
      method: 'PUT',
      url: `${flagBase}/targeted/environments/${dev.slug}/strategies`,
      headers: { authorization: adminKey },
      payload: {
        strategies: [{ constraints: [{ fieldKey: 'plan', operator: 'equals', values: ['pro'] }] }],
      },
    })

    /** One strategy spanning every non-string field type, ANDed together. */
    await app.inject({
      method: 'PUT',
      url: `${flagBase}/typed-context/environments/${dev.slug}/strategies`,
      headers: { authorization: adminKey },
      payload: {
        strategies: [
          {
            constraints: [
              { fieldKey: 'seats', operator: 'gte', values: ['10'] },
              { fieldKey: 'isBeta', operator: 'is', values: ['true'] },
              { fieldKey: 'signupDate', operator: 'after', values: ['2020-01-01T00:00:00.000Z'] },
              { fieldKey: 'appVersion', operator: 'gte', values: ['2.0.0'] },
            ],
          },
        ],
      },
    })

    clientKey = await createClientKey(app, adminKey, project.id, dev.id)
  })

  afterAll(async () => {
    await app?.close()
  })

  describe('authentication', () => {
    it('accepts the raw client key the SDK sends as the Authorization header', async () => {
      await expect(sdk().isEnabled('always-on')).resolves.toBe(true)
    })

    it('surfaces the server error envelope as a FlagraftError for an admin key', async () => {
      const wrongTier = new FlagraftClient({ baseUrl, apiKey: adminKey, ttl: 0 })
      await expect(wrongTier.isEnabled('always-on')).rejects.toBeInstanceOf(FlagraftError)
      await expect(wrongTier.isEnabled('always-on')).rejects.toMatchObject({
        statusCode: 403,
        code: 'Forbidden',
      })
    })

    it('rejects an unknown key', async () => {
      const bogus = new FlagraftClient({ baseUrl, apiKey: 'ff_not_a_real_key', ttl: 0 })
      await expect(bogus.isEnabled('always-on')).rejects.toMatchObject({ statusCode: 401 })
    })
  })

  describe('evaluation', () => {
    it('reports an enabled flag with no strategies as on', async () => {
      await expect(sdk().isEnabled('always-on')).resolves.toBe(true)
    })

    it('reports a flag disabled in the environment as off', async () => {
      await expect(sdk().isEnabled('switched-off')).resolves.toBe(false)
    })

    it('returns false for a flag the server does not know', async () => {
      await expect(sdk().isEnabled('no-such-flag')).resolves.toBe(false)
    })

    it('matches a targeting strategy against SDK-supplied context', async () => {
      const client = sdk()
      await expect(client.isEnabled('targeted', { plan: 'pro' })).resolves.toBe(true)
      await expect(client.isEnabled('targeted', { plan: 'free' })).resolves.toBe(false)
    })

    it('evaluates off when a targeted context field is missing entirely', async () => {
      await expect(sdk().isEnabled('targeted')).resolves.toBe(false)
    })
  })

  /**
   * The highest-value case here: the SDK stringifies JS values into the query
   * string and the server coerces them back using each field's registered
   * type. Both halves have to agree, and only a real round trip proves it.
   */
  describe('context value coercion across the wire', () => {
    const matching = {
      seats: 25,
      isBeta: true,
      signupDate: new Date('2026-01-15T00:00:00.000Z'),
      appVersion: '2.5.1',
    }

    it('matches when numbers, booleans, Dates and versions all satisfy the strategy', async () => {
      await expect(sdk().isEnabled('typed-context', matching)).resolves.toBe(true)
    })

    it('fails the number constraint when the value is below the threshold', async () => {
      await expect(sdk().isEnabled('typed-context', { ...matching, seats: 5 })).resolves.toBe(false)
    })

    it('fails the boolean constraint when the flag is false', async () => {
      await expect(sdk().isEnabled('typed-context', { ...matching, isBeta: false })).resolves.toBe(
        false,
      )
    })

    it('fails the date constraint when the Date predates the boundary', async () => {
      await expect(
        sdk().isEnabled('typed-context', { ...matching, signupDate: new Date('2019-01-01') }),
      ).resolves.toBe(false)
    })

    it('fails the version constraint when the version is too old', async () => {
      await expect(
        sdk().isEnabled('typed-context', { ...matching, appVersion: '1.9.9' }),
      ).resolves.toBe(false)
    })
  })

  describe('bulk evaluation', () => {
    it('parses the { features: [...] } envelope into a keyed map', async () => {
      const features = await sdk().getFeatures({ plan: 'pro' })
      expect(features).toMatchObject({
        'always-on': true,
        'switched-off': false,
        targeted: true,
      })
    })

    it('returns every project flag, not only the enabled ones', async () => {
      const features = await sdk().getAllFeatures()
      expect(features.map((f) => f.name).sort()).toEqual([
        'always-on',
        'switched-off',
        'targeted',
        'typed-context',
      ])
      expect(features.every((f) => typeof f.enabled === 'boolean')).toBe(true)
    })

    it('agrees with the single-flag endpoint for the same context', async () => {
      const context = { plan: 'pro' }
      const bulk = await sdk().getFeatures(context)
      const single = await sdk().isEnabled('targeted', context)
      expect(single).toBe(bulk.targeted)
    })
  })

  describe('response shape', () => {
    it('only ever returns reason values the SDK type declares', async () => {
      const declared = ['disabled', 'strategy-match', 'default']
      for (const flagKey of ['always-on', 'switched-off', 'targeted']) {
        const response = await fetch(`${baseUrl}/api/v1/client/features/${flagKey}`, {
          headers: { authorization: clientKey },
        })
        const body = (await response.json()) as { name: string; enabled: boolean; reason: string }
        expect(body.name).toBe(flagKey)
        expect(typeof body.enabled).toBe('boolean')
        expect(declared).toContain(body.reason)
      }
    })

    it('serves a 404 body matching the ServerErrorBody shape the SDK parses', async () => {
      const response = await fetch(`${baseUrl}/api/v1/client/features/no-such-flag`, {
        headers: { authorization: clientKey },
      })
      expect(response.status).toBe(404)
      const body = (await response.json()) as Record<string, unknown>
      expect(typeof body.error).toBe('string')
      expect(typeof body.message).toBe('string')
      expect(body.statusCode).toBe(404)
    })
  })

  describe('caching against a live server', () => {
    it('does not re-request within the TTL, then reflects a change after it lapses', async () => {
      const client = sdk(60)
      await expect(client.isEnabled('always-on')).resolves.toBe(true)

      /** Server-side change the cached client must not see yet. */
      const project = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/projects',
        headers: { authorization: adminKey },
      })
      const projectId = project
        .json<Array<{ id: string; slug: string }>>()
        .find((p) => p.slug === 'sdk-contract')!.id
      await post(
        adminKey,
        `/api/v1/admin/projects/${projectId}/flags/always-on/environments/development/disable`,
      )

      await expect(client.isEnabled('always-on')).resolves.toBe(true)
      await expect(sdk().isEnabled('always-on')).resolves.toBe(false)
    })
  })
})
