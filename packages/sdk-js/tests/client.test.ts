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
        return HttpResponse.json({ name: 'checkout-v2', enabled: true, reason: 'strategy-match' })
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

describe('stale-on-error', () => {
  it('serves the last known value when a refetch fails', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/flaky`, () =>
        up
          ? HttpResponse.json({ name: 'flaky', enabled: true, reason: 'default' })
          : HttpResponse.error(),
      ),
    )

    const onStale = vi.fn()
    const client = makeClient({ ttl: 30, staleTtl: 300, onStale })
    const fetchedAt = new Date()
    await expect(client.isEnabled('flaky')).resolves.toBe(true)

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('flaky')).resolves.toBe(true)
    expect(onStale).toHaveBeenCalledWith({ flagKey: 'flaky', fetchedAt })
    vi.useRealTimers()
  })

  it('falls back to the default once the stale window closes', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/expiring`, () =>
        up
          ? HttpResponse.json({ name: 'expiring', enabled: true, reason: 'default' })
          : HttpResponse.error(),
      ),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 30, staleTtl: 300 })
    await client.isEnabled('expiring')

    up = false
    vi.advanceTimersByTime(331_000)
    await expect(client.isEnabled('expiring')).resolves.toBe(false)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('serves stale after an HTTP error instead of throwing', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/degraded`, () =>
        up
          ? HttpResponse.json({ name: 'degraded', enabled: true, reason: 'default' })
          : HttpResponse.json(
              { error: 'InternalServerError', message: 'Internal error', statusCode: 500 },
              { status: 500 },
            ),
      ),
    )

    const client = makeClient({ ttl: 30, staleTtl: 300, onStale: () => {} })
    await client.isEnabled('degraded')

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('degraded')).resolves.toBe(true)
    vi.useRealTimers()
  })

  it('still throws when there is no stale value to fall back to', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/forbidden-cold`, () =>
        HttpResponse.json(
          { error: 'Forbidden', message: 'Client key required', statusCode: 403 },
          { status: 403 },
        ),
      ),
    )

    const client = makeClient({ staleTtl: 300 })
    await expect(client.isEnabled('forbidden-cold')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('serves the stale feature list for getAllFeatures', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        up ? HttpResponse.json({ features: [{ name: 'a', enabled: true }] }) : HttpResponse.error(),
      ),
    )

    const onStale = vi.fn()
    const client = makeClient({ ttl: 30, staleTtl: 300, onStale })
    const fetchedAt = new Date()
    await client.getAllFeatures()

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])
    expect(onStale).toHaveBeenCalledWith({ flagKey: null, fetchedAt })
    vi.useRealTimers()
  })

  it('does not let a throwing onStale callback break evaluation', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/noisy`, () =>
        up
          ? HttpResponse.json({ name: 'noisy', enabled: true, reason: 'default' })
          : HttpResponse.error(),
      ),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({
      ttl: 30,
      staleTtl: 300,
      onStale: () => {
        throw new Error('logger exploded')
      },
    })
    await client.isEnabled('noisy')

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('noisy')).resolves.toBe(true)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('keeps 404 as false rather than serving stale', async () => {
    vi.useFakeTimers()
    let exists = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/deleted`, () =>
        exists
          ? HttpResponse.json({ name: 'deleted', enabled: true, reason: 'default' })
          : HttpResponse.json(
              { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
              { status: 404 },
            ),
      ),
    )

    const onStale = vi.fn()
    const client = makeClient({ ttl: 30, staleTtl: 300, onStale })
    await client.isEnabled('deleted')

    exists = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('deleted')).resolves.toBe(false)
    expect(onStale).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

/**
 * These use a fetch override rather than msw so the request can hang until the
 * SDK's own signal aborts it, which is the behaviour under test.
 */
describe('request timeout', () => {
  /** Never settles on its own; rejects only when the caller's signal fires. */
  function hangingFetch(): typeof fetch {
    return ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error))
      })) as unknown as typeof fetch
  }

  function respondingFetch(body: unknown, capture?: (init?: RequestInit) => void): typeof fetch {
    return ((_url: string, init?: RequestInit) => {
      capture?.(init)
      return Promise.resolve(new Response(JSON.stringify(body)))
    }) as unknown as typeof fetch
  }

  it('passes an abort signal on every request by default', async () => {
    let seen: AbortSignal | null | undefined
    const client = makeClient({
      fetch: respondingFetch({ name: 'x', enabled: true, reason: 'default' }, (init) => {
        seen = init?.signal
      }),
    })

    await client.isEnabled('x')
    expect(seen).toBeInstanceOf(AbortSignal)
    expect(seen?.aborted).toBe(false)
  })

  it('sends no signal when timeoutMs is 0', async () => {
    let seen: AbortSignal | null | undefined
    const client = makeClient({
      timeoutMs: 0,
      fetch: respondingFetch({ name: 'x', enabled: true, reason: 'default' }, (init) => {
        seen = init?.signal
      }),
    })

    await client.isEnabled('x')
    expect(seen).toBeUndefined()
  })

  it('aborts a hanging request instead of waiting forever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ timeoutMs: 20, staleTtl: 0, fetch: hangingFetch() })

    await expect(client.isEnabled('slow')).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns an empty list when a bulk request times out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ timeoutMs: 20, staleTtl: 0, fetch: hangingFetch() })

    await expect(client.getAllFeatures()).resolves.toEqual([])
    warn.mockRestore()
  })

  it('serves the stale value when a refetch times out', async () => {
    let hang = false
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      if (!hang) {
        return Promise.resolve(
          new Response(JSON.stringify({ name: 'slow', enabled: true, reason: 'default' })),
        )
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error))
      })
    }) as unknown as typeof fetch

    const onStale = vi.fn()
    /** 50ms fresh window so the entry expires without fake timers. */
    const client = makeClient({ ttl: 0.05, staleTtl: 60, timeoutMs: 20, onStale, fetch: fetchImpl })
    await expect(client.isEnabled('slow')).resolves.toBe(true)

    hang = true
    await new Promise((resolve) => setTimeout(resolve, 70))
    await expect(client.isEnabled('slow')).resolves.toBe(true)
    expect(onStale).toHaveBeenCalledTimes(1)
  })
})

describe('context value coercion', () => {
  it('stringifies numbers, booleans and Dates into the query string', async () => {
    let query = ''
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/typed`, ({ request }) => {
        query = new URL(request.url).search
        return HttpResponse.json({ name: 'typed', enabled: true, reason: 'strategy-match' })
      }),
    )

    const client = makeClient()
    await client.isEnabled('typed', {
      userId: 42,
      isBeta: true,
      signupDate: new Date('2026-01-15T00:00:00.000Z'),
    })

    const params = new URLSearchParams(query)
    expect(params.get('userId')).toBe('42')
    expect(params.get('isBeta')).toBe('true')
    expect(params.get('signupDate')).toBe('2026-01-15T00:00:00.000Z')
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
