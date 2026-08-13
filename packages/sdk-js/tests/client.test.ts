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

describe('conditional requests', () => {
  /**
   * Stands in for the server: answers 304 when the client sends back a
   * matching ETag, and counts how many full bodies it had to serialise.
   */
  function conditionalBulk(etag: string) {
    const counts = { requests: 0, bodies: 0 }
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, ({ request }) => {
        counts.requests += 1
        if (request.headers.get('if-none-match') === etag) {
          return new HttpResponse(null, { status: 304, headers: { etag } })
        }
        counts.bodies += 1
        return HttpResponse.json(
          { features: [{ name: 'a', enabled: true }] },
          { headers: { etag } },
        )
      }),
    )
    return counts
  }

  it('sends the stored ETag when revalidating', async () => {
    vi.useFakeTimers()
    let seen: string | null = null
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, ({ request }) => {
        seen = request.headers.get('if-none-match')
        return HttpResponse.json({ features: [] }, { headers: { etag: '"v1"' } })
      }),
    )

    const client = makeClient({ ttl: 30 })
    await client.getAllFeatures()
    expect(seen).toBeNull()

    vi.advanceTimersByTime(31_000)
    await client.getAllFeatures()
    expect(seen).toBe('"v1"')
    vi.useRealTimers()
  })

  it('keeps the cached body when the server answers 304', async () => {
    vi.useFakeTimers()
    const counts = conditionalBulk('"v1"')

    const client = makeClient({ ttl: 30 })
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])

    vi.advanceTimersByTime(31_000)
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])
    expect(counts).toEqual({ requests: 2, bodies: 1 })
    vi.useRealTimers()
  })

  it('gives the revalidated entry a fresh TTL', async () => {
    vi.useFakeTimers()
    const counts = conditionalBulk('"v1"')

    const client = makeClient({ ttl: 30 })
    await client.getAllFeatures()

    vi.advanceTimersByTime(31_000)
    await client.getAllFeatures() // 304, TTL restarts here

    vi.advanceTimersByTime(10_000)
    await client.getAllFeatures() // still fresh, no request at all
    expect(counts.requests).toBe(2)
    vi.useRealTimers()
  })

  it('takes the new body when the flags actually changed', async () => {
    vi.useFakeTimers()
    let version = 1
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, ({ request }) => {
        const etag = `"v${version}"`
        if (request.headers.get('if-none-match') === etag) {
          return new HttpResponse(null, { status: 304, headers: { etag } })
        }
        return HttpResponse.json(
          { features: [{ name: 'a', enabled: version === 1 }] },
          { headers: { etag } },
        )
      }),
    )

    const client = makeClient({ ttl: 30 })
    await expect(client.getFeatures()).resolves.toEqual({ a: true })

    version = 2
    vi.advanceTimersByTime(31_000)
    await expect(client.getFeatures()).resolves.toEqual({ a: false })
    vi.useRealTimers()
  })

  it('does not revalidate once the body has been dropped entirely', async () => {
    vi.useFakeTimers()
    let seen: string | null = 'unset'
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, ({ request }) => {
        seen = request.headers.get('if-none-match')
        return HttpResponse.json({ features: [] }, { headers: { etag: '"v1"' } })
      }),
    )

    const client = makeClient({ ttl: 30, staleTtl: 60 })
    await client.getAllFeatures()

    /** Past ttl + staleTtl the entry is gone, so revalidating would be unsafe. */
    vi.advanceTimersByTime(95_000)
    await client.getAllFeatures()
    expect(seen).toBeNull()
    vi.useRealTimers()
  })

  it('works against a server that sends no ETag at all', async () => {
    vi.useFakeTimers()
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        HttpResponse.json({ features: [{ name: 'a', enabled: true }] }),
      ),
    )

    const client = makeClient({ ttl: 30 })
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])
    vi.advanceTimersByTime(31_000)
    await expect(client.getAllFeatures()).resolves.toEqual([{ name: 'a', enabled: true }])
    vi.useRealTimers()
  })
})

describe('answering isEnabled from a bulk response', () => {
  /** Counts calls to each endpoint so we can prove which door was used. */
  function endpoints(features: Array<{ name: string; enabled: boolean }>) {
    const counts = { bulk: 0, single: 0 }
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () => {
        counts.bulk += 1
        return HttpResponse.json({ features })
      }),
      http.get(`${BASE}/api/v1/client/features/:flagKey`, ({ params }) => {
        counts.single += 1
        const match = features.find((f) => f.name === params.flagKey)
        return match
          ? HttpResponse.json({ ...match, reason: 'default' })
          : HttpResponse.json(
              { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
              { status: 404 },
            )
      }),
    )
    return counts
  }

  it('reuses a hydrated bulk response instead of asking again', async () => {
    const counts = endpoints([
      { name: 'a', enabled: true },
      { name: 'b', enabled: false },
    ])

    const client = makeClient()
    await client.getFeatures({ userId: 'u1' })
    await expect(client.isEnabled('a', { userId: 'u1' })).resolves.toBe(true)
    await expect(client.isEnabled('b', { userId: 'u1' })).resolves.toBe(false)
    expect(counts).toEqual({ bulk: 1, single: 0 })
  })

  it('treats a flag absent from the bulk list as missing, with no request', async () => {
    const counts = endpoints([{ name: 'a', enabled: true }])

    const client = makeClient()
    await client.getFeatures()
    await expect(client.isEnabled('ghost')).resolves.toBe(false)
    await expect(client.isEnabled('ghost', {}, true)).resolves.toBe(true)
    expect(counts.single).toBe(0)
  })

  it('does not reuse a bulk response fetched for a different context', async () => {
    const counts = endpoints([{ name: 'a', enabled: true }])

    const client = makeClient()
    await client.getFeatures({ userId: 'u1' })
    await client.isEnabled('a', { userId: 'u2' })
    expect(counts.single).toBe(1)
  })

  it('falls through to the single endpoint when no bulk response is cached', async () => {
    const counts = endpoints([{ name: 'a', enabled: true }])

    const client = makeClient()
    await expect(client.isEnabled('a')).resolves.toBe(true)
    expect(counts).toEqual({ bulk: 0, single: 1 })
  })

  it('ignores the bulk cache when ttl is 0', async () => {
    const counts = endpoints([{ name: 'a', enabled: true }])

    const client = makeClient({ ttl: 0 })
    await client.getFeatures()
    await client.isEnabled('a')
    expect(counts.single).toBe(1)
  })

  it('serves a stale bulk response when a refetch fails', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        up ? HttpResponse.json({ features: [{ name: 'a', enabled: true }] }) : HttpResponse.error(),
      ),
      http.get(`${BASE}/api/v1/client/features/a`, () =>
        up
          ? HttpResponse.json({ name: 'a', enabled: true, reason: 'default' })
          : HttpResponse.error(),
      ),
    )

    const onStale = vi.fn()
    const client = makeClient({ ttl: 30, staleTtl: 300, onStale })
    await client.getFeatures()

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('a')).resolves.toBe(true)
    expect(onStale).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('server errors versus caller errors', () => {
  function respond(flagKey: string, status: number, error: string) {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/${flagKey}`, () =>
        HttpResponse.json({ error, message: 'boom', statusCode: status }, { status }),
      ),
    )
  }

  it.each([500, 502, 503, 504])(
    'falls back to the default on %i rather than throwing',
    async (status) => {
      respond(`broken-${status}`, status, 'InternalServerError')

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const client = makeClient({ staleTtl: 0 })
      await expect(client.isEnabled(`broken-${status}`)).resolves.toBe(false)
      await expect(client.isEnabled(`broken-${status}`, {}, true)).resolves.toBe(true)
      warn.mockRestore()
    },
  )

  it.each([400, 401, 403])('still throws on %i, which is the caller to fix', async (status) => {
    respond(`refused-${status}`, status, 'Forbidden')

    const client = makeClient({ staleTtl: 0 })
    await expect(client.isEnabled(`refused-${status}`)).rejects.toMatchObject({
      statusCode: status,
    })
  })

  it('returns an empty list for a bulk call that hits a 500', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        HttpResponse.json(
          { error: 'InternalServerError', message: 'boom', statusCode: 500 },
          { status: 500 },
        ),
      ),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ staleTtl: 0 })
    await expect(client.getAllFeatures()).resolves.toEqual([])
    warn.mockRestore()
  })

  it('still prefers a stale value over the default on a 500', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/wobbly`, () =>
        up
          ? HttpResponse.json({ name: 'wobbly', enabled: true, reason: 'default' })
          : HttpResponse.json(
              { error: 'InternalServerError', message: 'boom', statusCode: 500 },
              { status: 500 },
            ),
      ),
    )

    const client = makeClient({ ttl: 30, staleTtl: 300, onStale: () => {} })
    await client.isEnabled('wobbly')

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('wobbly', {}, false)).resolves.toBe(true)
    vi.useRealTimers()
  })
})

describe('rate limiting', () => {
  /** Answers 429 with the given Retry-After and counts every request. */
  function limited(flagKey: string, counter: { calls: number }, retryAfter?: string) {
    return http.get(`${BASE}/api/v1/client/features/${flagKey}`, () => {
      counter.calls += 1
      return HttpResponse.json(
        { error: 'TooManyRequests', message: 'Rate limit exceeded', statusCode: 429 },
        { status: 429, headers: retryAfter ? { 'retry-after': retryAfter } : {} },
      )
    })
  }

  it('falls back to the default instead of throwing', async () => {
    const counter = { calls: 0 }
    mswServer.use(limited('busy', counter, '1'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ staleTtl: 0 })
    await expect(client.isEnabled('busy')).resolves.toBe(false)
    await expect(client.isEnabled('busy', {}, true)).resolves.toBe(true)
    warn.mockRestore()
  })

  it('serves a stale value when one exists', async () => {
    vi.useFakeTimers()
    let limitHit = false
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/throttled`, () =>
        limitHit
          ? HttpResponse.json(
              { error: 'TooManyRequests', message: 'Rate limit exceeded', statusCode: 429 },
              { status: 429, headers: { 'retry-after': '1' } },
            )
          : HttpResponse.json({ name: 'throttled', enabled: true, reason: 'default' }),
      ),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 30, staleTtl: 300, onStale: () => {} })
    await client.isEnabled('throttled')

    limitHit = true
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('throttled')).resolves.toBe(true)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('stops sending requests for the Retry-After window', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('flood', counter, '30'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('flood')
    await client.isEnabled('flood')
    await client.isEnabled('flood')
    expect(counter.calls).toBe(1)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('resumes once the window passes', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('resume', counter, '30'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('resume')
    await client.isEnabled('resume')
    expect(counter.calls).toBe(1)

    vi.advanceTimersByTime(31_000)
    await client.isEnabled('resume')
    expect(counter.calls).toBe(2)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('backs off for a default window when Retry-After is missing', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('bare', counter))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('bare')

    vi.advanceTimersByTime(4_000)
    await client.isEnabled('bare')
    expect(counter.calls).toBe(1)

    vi.advanceTimersByTime(2_000)
    await client.isEnabled('bare')
    expect(counter.calls).toBe(2)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('accepts an HTTP-date Retry-After', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T00:00:00.000Z'))
    const counter = { calls: 0 }
    mswServer.use(limited('dated', counter, 'Sun, 09 Aug 2026 00:00:20 GMT'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('dated')

    vi.advanceTimersByTime(10_000)
    await client.isEnabled('dated')
    expect(counter.calls).toBe(1)

    vi.advanceTimersByTime(11_000)
    await client.isEnabled('dated')
    expect(counter.calls).toBe(2)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('caps an absurd Retry-After rather than muting the client for hours', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('absurd', counter, '86400'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('absurd')

    vi.advanceTimersByTime(61_000)
    await client.isEnabled('absurd')
    expect(counter.calls).toBe(2)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('ignores an unparseable Retry-After and uses the default window', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('garbage', counter, 'soon-ish'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('garbage')

    vi.advanceTimersByTime(6_000)
    await client.isEnabled('garbage')
    expect(counter.calls).toBe(2)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('warns once per backoff window rather than once per call', async () => {
    vi.useFakeTimers()
    const counter = { calls: 0 }
    mswServer.use(limited('noisy-limit', counter, '30'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ ttl: 0 })
    await client.isEnabled('noisy-limit')
    await client.isEnabled('noisy-limit')
    await client.isEnabled('noisy-limit')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    vi.useRealTimers()
  })

  it('returns an empty list for a rate-limited bulk call', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features`, () =>
        HttpResponse.json(
          { error: 'TooManyRequests', message: 'Rate limit exceeded', statusCode: 429 },
          { status: 429, headers: { 'retry-after': '1' } },
        ),
      ),
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ staleTtl: 0 })
    await expect(client.getAllFeatures()).resolves.toEqual([])
    warn.mockRestore()
  })
})

describe('defaultValue', () => {
  it('is returned when the flag does not exist', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/absent`, () =>
        HttpResponse.json(
          { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
          { status: 404 },
        ),
      ),
    )

    const client = makeClient()
    await expect(client.isEnabled('absent', {}, true)).resolves.toBe(true)
  })

  it('is returned when the request fails outright', async () => {
    mswServer.use(http.get(`${BASE}/api/v1/client/features/down`, () => HttpResponse.error()))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ staleTtl: 0 })
    await expect(client.isEnabled('down', {}, true)).resolves.toBe(true)
    warn.mockRestore()
  })

  it('is returned when the request times out', async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error))
      })) as unknown as typeof fetch

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ timeoutMs: 20, staleTtl: 0, fetch: hangingFetch })
    await expect(client.isEnabled('slow', {}, true)).resolves.toBe(true)
    warn.mockRestore()
  })

  it('never overrides a real answer from the server', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/really-off`, () =>
        HttpResponse.json({ name: 'really-off', enabled: false, reason: 'disabled' }),
      ),
    )

    const client = makeClient()
    await expect(client.isEnabled('really-off', {}, true)).resolves.toBe(false)
  })

  it('loses to a stale value, which is a real reading rather than a guess', async () => {
    vi.useFakeTimers()
    let up = true
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/was-off`, () =>
        up
          ? HttpResponse.json({ name: 'was-off', enabled: false, reason: 'disabled' })
          : HttpResponse.error(),
      ),
    )

    const client = makeClient({ ttl: 30, staleTtl: 300, onStale: () => {} })
    await client.isEnabled('was-off', {}, true)

    up = false
    vi.advanceTimersByTime(31_000)
    await expect(client.isEnabled('was-off', {}, true)).resolves.toBe(false)
    vi.useRealTimers()
  })

  it('lets two callers hold different defaults for the same missing flag', async () => {
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/shared`, () => {
        calls += 1
        return HttpResponse.json(
          { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
          { status: 404 },
        )
      }),
    )

    const client = makeClient()
    await expect(client.isEnabled('shared', {}, true)).resolves.toBe(true)
    await expect(client.isEnabled('shared', {}, false)).resolves.toBe(false)
    expect(calls).toBe(1)
  })

  it('still throws on a misconfiguration rather than hiding it behind the default', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/denied`, () =>
        HttpResponse.json(
          { error: 'Forbidden', message: 'Client key required', statusCode: 403 },
          { status: 403 },
        ),
      ),
    )

    const client = makeClient({ staleTtl: 0 })
    await expect(client.isEnabled('denied', {}, true)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('defaults to false when the argument is omitted', async () => {
    mswServer.use(http.get(`${BASE}/api/v1/client/features/legacy`, () => HttpResponse.error()))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeClient({ staleTtl: 0 })
    await expect(client.isEnabled('legacy')).resolves.toBe(false)
    warn.mockRestore()
  })
})

describe('caching unknown flags', () => {
  /** Counts requests and always answers 404, like a mistyped flag key. */
  function missingHandler(flagKey: string, counter: { calls: number }) {
    return http.get(`${BASE}/api/v1/client/features/${flagKey}`, () => {
      counter.calls += 1
      return HttpResponse.json(
        { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
        { status: 404 },
      )
    })
  }

  it('asks the server only once for a flag that does not exist', async () => {
    const counter = { calls: 0 }
    mswServer.use(missingHandler('typo', counter))

    const client = makeClient()
    await expect(client.isEnabled('typo')).resolves.toBe(false)
    await expect(client.isEnabled('typo')).resolves.toBe(false)
    await expect(client.isEnabled('typo')).resolves.toBe(false)
    expect(counter.calls).toBe(1)
  })

  it('shares one entry across every context, since existence is context-free', async () => {
    const counter = { calls: 0 }
    mswServer.use(missingHandler('typo', counter))

    const client = makeClient()
    await client.isEnabled('typo', { userId: 'u1' })
    await client.isEnabled('typo', { userId: 'u2' })
    await client.isEnabled('typo', { userId: 'u3', plan: 'pro' })
    expect(counter.calls).toBe(1)
  })

  it('asks again once the negative entry lapses, so a newly created flag is picked up', async () => {
    vi.useFakeTimers()
    let exists = false
    let calls = 0
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/late`, () => {
        calls += 1
        return exists
          ? HttpResponse.json({ name: 'late', enabled: true, reason: 'default' })
          : HttpResponse.json(
              { error: 'NotFound', message: 'Flag not found', statusCode: 404 },
              { status: 404 },
            )
      }),
    )

    const client = makeClient()
    await expect(client.isEnabled('late')).resolves.toBe(false)

    exists = true
    await expect(client.isEnabled('late')).resolves.toBe(false)
    expect(calls).toBe(1)

    vi.advanceTimersByTime(6_000)
    await expect(client.isEnabled('late')).resolves.toBe(true)
    expect(calls).toBe(2)
    vi.useRealTimers()
  })

  it('is switched off along with everything else when ttl is 0', async () => {
    const counter = { calls: 0 }
    mswServer.use(missingHandler('uncached', counter))

    const client = makeClient({ ttl: 0 })
    await client.isEnabled('uncached')
    await client.isEnabled('uncached')
    expect(counter.calls).toBe(2)
  })

  it('leaves flags that do exist untouched', async () => {
    mswServer.use(
      http.get(`${BASE}/api/v1/client/features/real`, () =>
        HttpResponse.json({ name: 'real', enabled: true, reason: 'default' }),
      ),
    )
    const counter = { calls: 0 }
    mswServer.use(missingHandler('fake', counter))

    const client = makeClient()
    await expect(client.isEnabled('fake')).resolves.toBe(false)
    await expect(client.isEnabled('real')).resolves.toBe(true)
    expect(counter.calls).toBe(1)
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
