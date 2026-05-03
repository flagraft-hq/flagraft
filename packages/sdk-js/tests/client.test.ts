import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { FlagraftClient } from '../src/client.js'
import { mswServer } from './msw-server.js'

const BASE = 'https://flags.example.test'

function makeClient(overrides: Partial<ConstructorParameters<typeof FlagraftClient>[0]> = {}) {
  return new FlagraftClient({
    baseUrl: BASE,
    apiKey: 'ff_testkey',
    ttl: 30,
    ...overrides,
  })
}

describe('FlagraftClient.isEnabled', () => {
  it('returns true when server reports enabled', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/checkout-v2`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('ff_testkey')
        return HttpResponse.json({ name: 'checkout-v2', enabled: true, reason: 'override' })
      }),
    )

    const client = makeClient()
    await expect(client.isEnabled('checkout-v2', { userId: 'u1' })).resolves.toBe(true)
  })

  it('returns false on network failure without throwing', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/checkout-v2`, () => HttpResponse.error()),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient()
    await expect(client.isEnabled('checkout-v2')).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns false when flag is unknown (404)', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/missing`, () =>
        HttpResponse.json(
          { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
          { status: 404 },
        ),
      ),
    )

    const client = makeClient()
    await expect(client.isEnabled('missing')).resolves.toBe(false)
  })

  it('throws FlagraftError on 4xx other than 404', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/forbidden`, () =>
        HttpResponse.json(
          { error: 'Forbidden', message: 'Client key required', statusCode: 403 },
          { status: 403 },
        ),
      ),
    )

    const client = makeClient()
    await expect(client.isEnabled('forbidden')).rejects.toMatchObject({
      name: 'FlagraftError',
      statusCode: 403,
      code: 'Forbidden',
    })
  })

  it('caches subsequent calls within ttl', async () => {
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/cached`, () => {
        calls += 1
        return HttpResponse.json({ name: 'cached', enabled: true, reason: 'default' })
      }),
    )

    const client = makeClient({ ttl: 30 })
    await client.isEnabled('cached', { userId: 'u1' })
    await client.isEnabled('cached', { userId: 'u1' })
    expect(calls).toBe(1)
  })

  it('bypasses cache when ttl=0', async () => {
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/no-cache`, () => {
        calls += 1
        return HttpResponse.json({ name: 'no-cache', enabled: false, reason: 'default' })
      }),
    )

    const client = makeClient({ ttl: 0 })
    await client.isEnabled('no-cache')
    await client.isEnabled('no-cache')
    expect(calls).toBe(2)
  })
})

describe('FlagraftClient.getFeatures', () => {
  it('returns flag map keyed by name', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        HttpResponse.json({
          features: [
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
          ],
        }),
      ),
    )

    const client = makeClient()
    await expect(client.getFeatures({ userId: 'u1' })).resolves.toEqual({ a: true, b: false })
  })

  it('caches the bulk response by context', async () => {
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () => {
        calls += 1
        return HttpResponse.json({ features: [{ name: 'a', enabled: true }] })
      }),
    )

    const client = makeClient({ ttl: 30 })
    await client.getFeatures({ userId: 'u1' })
    await client.getFeatures({ userId: 'u1' })
    expect(calls).toBe(1)
  })

  it('issues a fresh request after ttl expiry', async () => {
    vi.useFakeTimers()
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () => {
        calls += 1
        return HttpResponse.json({ features: [{ name: 'a', enabled: true }] })
      }),
    )

    const client = makeClient({ ttl: 1 })
    await client.getFeatures()
    vi.advanceTimersByTime(1500)
    await client.getFeatures()
    expect(calls).toBe(2)
    vi.useRealTimers()
  })
})

describe('FlagraftClient.getAllFeatures', () => {
  it('returns the raw feature array', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        HttpResponse.json({ features: [{ name: 'a', enabled: true }] }),
      ),
    )

    const client = makeClient()
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])
  })
})
