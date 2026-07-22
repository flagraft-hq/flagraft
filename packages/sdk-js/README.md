# @flagraft/sdk

The official TypeScript SDK for [Flagraft](../../README.md), a self-hosted feature flag service. The SDK gives your application a typed, cached, fail-safe client for evaluating flags so you do not have to hand-roll HTTP calls, retry logic, or local caching.

> Built for Node 20+, modern bundlers, and edge runtimes that ship `globalThis.fetch`. Ships as dual CommonJS and ESM with full `.d.ts` declarations.

---

## Why use the SDK?

- **Safe by default.** Network failures resolve to `false` so a flag check never crashes your request handler.
- **Cached out of the box.** A small in-memory TTL cache keyed by `(flagKey, context)` removes redundant round trips during a request burst.
- **Strongly typed.** `EvaluationContext`, `Feature`, `EvaluationResult`, and `FlagraftClientOptions` are exported types you can reuse in your own code.
- **Zero runtime dependencies.** Uses native `fetch`. Bundles cleanly into Lambda, Cloudflare Workers, Vercel Edge, and any modern Node deployment.
- **Three useful primitives.** Single flag (`isEnabled`), key/value map (`getFeatures`), and raw array (`getAllFeatures`) cover most consumption patterns.

---

## Install

```bash
pnpm add @flagraft/sdk
# or
npm install @flagraft/sdk
# or
yarn add @flagraft/sdk
```

**Requirements:**

- Node.js 20 or newer (for native `fetch`).
- A running Flagraft server reachable from your app.
- A **client API key** issued by a project admin. (Admin keys are rejected at the evaluation routes, see "Authentication" below.)

---

## Quickstart

```ts
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
  baseUrl: 'https://flags.example.com',
  apiKey: process.env.FLAGRAFT_KEY!,
})

const enabled = await flags.isEnabled('checkout-v2', { userId: 'u_42' })

if (enabled) {
  // render the new checkout
} else {
  // render the old checkout
}
```

That is the entire surface area for the most common case. The rest of this document explains the options, the other methods, and how to plug the SDK into common environments.

---

## Configuration

The constructor accepts a single options object.

```ts
new FlagraftClient({
  baseUrl: 'https://flags.example.com',
  apiKey: 'ff_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  ttl: 30,
  fetch: globalThis.fetch,
})
```

| Option    | Type           | Default            | Description                                                                                                      |
| --------- | -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `baseUrl` | `string`       | (required)         | Base URL of the Flagraft server. Trailing slashes are normalized away. The SDK appends `/api/v1/...` itself.     |
| `apiKey`  | `string`       | (required)         | A client API key. Sent as the raw `Authorization` header value (no `Bearer` prefix), matching the Flagraft auth. |
| `ttl`     | `number`       | `30`               | SDK-side cache TTL in seconds. Set to `0` to bypass the SDK cache (the server still has its own cache).          |
| `fetch`   | `typeof fetch` | `globalThis.fetch` | Optional `fetch` override. Useful for tests (with `msw`), custom transports, or environments without a global.   |

---

## Authentication

Flagraft has three key tiers (root admin, project admin, client). The SDK only works with **client keys** because the evaluation routes (`/api/v1/client/*`) reject everything else with `403 Forbidden`. Issue a client key from an admin context, scoped to the project and environment your app evaluates against.

The SDK sets the `Authorization` header to the raw key value. Do not prepend `Bearer` or any other scheme.

---

## API reference

### `isEnabled(flagKey, context?) => Promise<boolean>`

Evaluate a single flag and get a boolean back. This is the workhorse method.

```ts
// Simple on/off check
if (await flags.isEnabled('maintenance-mode')) {
  return res.status(503).send('Be right back')
}

// Targeted check with context
if (await flags.isEnabled('dark-mode', { userId: 'u_42' })) {
  // ...
}
```

The second argument is optional. See [`EvaluationContext`](#evaluationcontext) for details on targeting.

**Behaviour:**

- Returns `true` or `false` based on the server's evaluation, which considers whether the flag is enabled in the environment and whether any of its targeting strategies match the context.
- Returns `false` if the flag does not exist (the server responds 404).
- Returns `false` and logs a warning to `console.warn` if the request fails entirely (network down, DNS error, server unreachable, msw error response, abort).
- Throws `FlagraftError` on any other 4xx or 5xx response, so unexpected misconfiguration (bad key, scope mismatch, rate limit, server bug) surfaces loudly during integration.

### `getFeatures(context?) => Promise<Record<string, boolean>>`

Hydrate a UI in one call. Returns a plain object mapping flag name to enabled state.

```ts
const features = await flags.getFeatures({ userId: 'u_42', plan: 'pro' })
// { 'checkout-v2': true, 'dark-mode': false, 'beta-search': true }

if (features['checkout-v2']) {
  // ...
}
```

Useful for SSR pages or single-page apps where you want all flags resolved before the first render and want to avoid N round trips.

### `getAllFeatures(context?) => Promise<Feature[]>`

Same data as `getFeatures` but as an array, which is the raw server shape.

```ts
const features = await flags.getAllFeatures()
// [
//   { name: 'checkout-v2', enabled: true },
//   { name: 'dark-mode', enabled: false },
// ]
```

Pick this when you want to iterate, filter, or pass the array straight to a templating layer.

### `EvaluationContext`

The optional second argument on every method.

```ts
type ContextValue = string | number | boolean | Date
type EvaluationContext = Record<string, ContextValue>
```

Example shape:

```ts
const context: EvaluationContext = {
  userId: 'u_42',
  tenantId: 'acme',
  plan: 'pro',
  region: 'eu-west',
  cohort: 'beta-testers',
}

await flags.isEnabled('checkout-v2', context)
```

Pass the keys your flag's targeting strategies reference (these correspond to the project's registered context fields). Common examples: `userId`, `tenantId`, `plan`, `region`, `cohort`. The server matches each strategy's constraints against this context to decide whether a flag is on for the current caller.

The keys you send must match the context fields configured on the server. Values may be strings, numbers, booleans, or `Date`s — the client stringifies them on the wire (`Date` → ISO 8601), matching how the server coerces each field's type.

```ts
await flags.isEnabled('experiment-x', {
  userId: req.user.id, // number is fine, no need to stringify
  tenantId: req.user.tenantId,
  plan: req.user.plan,
  signupDate: req.user.createdAt, // a Date
})
```

### `FlagraftError`

Thrown by `isEnabled` (when `statusCode !== 404`), `getFeatures`, and `getAllFeatures` on unexpected HTTP failures.

```ts
import { FlagraftClient, FlagraftError } from '@flagraft/sdk'

try {
  const enabled = await flags.isEnabled('beta-search')
} catch (error) {
  if (error instanceof FlagraftError) {
    console.error('Flagraft request failed', {
      statusCode: error.statusCode, // e.g. 403
      code: error.code, // e.g. 'Forbidden'
      message: error.message, // server-supplied message
    })
  }
  throw error
}
```

The `code` and `message` fields are read directly from the server's standard error envelope: `{ error, message, statusCode }`.

---

## Caching

Flagraft has **two cache layers**, and they are independent:

1. **Server cache** (BentoCache, in-memory on the Flagraft server). Caches flag state per project and environment, invalidated automatically on any write. TTL is set by the server's `CACHE_TTL_SECONDS` env var (default `30`, minimum `1`). You cannot turn it off; it protects the database.
2. **SDK cache** (this library, in-memory in your process). Caches each `(flagKey, context)` and bulk response on top of the server cache. Configured via the `ttl` option.

What this means in practice: setting `ttl: 0` on the SDK skips the SDK cache and forces every call to hit the network, but the server may still answer from its own cache for up to `CACHE_TTL_SECONDS`. Freshness is bounded by the longer of the two TTLs.

The SDK cache key includes a stable JSON serialization of the context object, so `{ userId: 'u1', plan: 'pro' }` and `{ plan: 'pro', userId: 'u1' }` hit the same entry.

```ts
const flags = new FlagraftClient({ baseUrl, apiKey, ttl: 30 })

await flags.isEnabled('checkout-v2', { userId: 'u_42' }) // network call
await flags.isEnabled('checkout-v2', { userId: 'u_42' }) // SDK cache hit
await flags.isEnabled('checkout-v2', { userId: 'u_99' }) // network call, different context
```

**When you might want `ttl: 0` (SDK cache off):**

- A test suite that asserts on request counts.
- A short-lived Lambda where in-process caching adds no value.
- You already have a caching layer in front of the SDK and do not want a second one.

```ts
const flags = new FlagraftClient({ baseUrl, apiKey, ttl: 0 })
```

**TTL guidance:** the SDK default of `30` matches the server's default. Increase it for read-heavy workloads where stale flags are tolerable, decrease it when you want changes to propagate quickly. There is no background refresh; entries expire lazily on read.

> **Note:** the SDK cache is per `FlagraftClient` instance. Reuse a single instance across your application for cache hits to actually happen. Creating a new client per request defeats the cache.

---

## Error model

| Condition                         | Behaviour                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Server returns 200                | Result returned, cached for `ttl` seconds.                                                               |
| Network failure / fetch rejects   | `isEnabled` returns `false`, logs `console.warn`. `getFeatures` and `getAllFeatures` return `[]` / `{}`. |
| Server returns 404 (`isEnabled`)  | Returns `false` (the flag is treated as off).                                                            |
| Server returns 4xx (other)        | Throws `FlagraftError` with status, code, message.                                                       |
| Server returns 5xx                | Throws `FlagraftError`.                                                                                  |
| Server returns 429 (rate limited) | Throws `FlagraftError` with `statusCode: 429`.                                                           |

The split between "swallow" (network) and "throw" (HTTP error) is deliberate: network blips are routine and a flag check should never wedge a request, but a 403 means your key or scope is wrong and you want to know about it loudly.

---

## Usage examples

### Express middleware

```ts
import express from 'express'
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
  baseUrl: process.env.FLAGRAFT_BASE_URL!,
  apiKey: process.env.FLAGRAFT_KEY!,
})

const app = express()

app.use(async (req, res, next) => {
  res.locals.flags = await flags.getFeatures({
    userId: req.user?.id ?? 'anonymous',
    plan: req.user?.plan ?? 'free',
  })
  next()
})

app.get('/checkout', (req, res) => {
  if (res.locals.flags['checkout-v2']) {
    return res.render('checkout-v2')
  }
  return res.render('checkout-v1')
})
```

### Fastify plugin

```ts
import fp from 'fastify-plugin'
import { FlagraftClient } from '@flagraft/sdk'

declare module 'fastify' {
  interface FastifyInstance {
    flags: FlagraftClient
  }
}

export default fp(async (fastify) => {
  fastify.decorate(
    'flags',
    new FlagraftClient({
      baseUrl: process.env.FLAGRAFT_BASE_URL!,
      apiKey: process.env.FLAGRAFT_KEY!,
    }),
  )
})

// usage
fastify.get('/feature-x', async (request) => {
  const enabled = await fastify.flags.isEnabled('feature-x', {
    userId: request.user.id,
  })
  return { enabled }
})
```

### Next.js App Router (server component)

```tsx
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
  baseUrl: process.env.FLAGRAFT_BASE_URL!,
  apiKey: process.env.FLAGRAFT_KEY!,
})

export default async function Page() {
  const features = await flags.getFeatures({ region: 'eu' })

  return features['new-landing-page'] ? <NewLanding /> : <OldLanding />
}
```

### React hook (client side, with a thin wrapper)

The SDK is server-friendly. For the browser, proxy through your own backend so the API key never leaves the server. The pattern has two pieces:

**1. A backend route that uses the SDK and exposes the resolved flags.** Use whatever framework you already have. Example with Express:

```ts
// server/flags-route.ts
import { Router } from 'express'
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
  baseUrl: process.env.FLAGRAFT_BASE_URL!,
  apiKey: process.env.FLAGRAFT_KEY!,
})

export const flagsRouter = Router().get('/flags', async (req, res) => {
  const userId = String(req.query.userId ?? 'anonymous')
  const features = await flags.getFeatures({ userId })
  res.json(features)
})
```

**2. A React hook that calls that backend route, never the Flagraft server directly:**

```tsx
// hooks/useFeatures.ts
import { useEffect, useState } from 'react'

export function useFeatures(userId: string) {
  const [features, setFeatures] = useState<Record<string, boolean>>({})

  // calls your backend, never Flagraft directly
  useEffect(() => {
    fetch(`/api/flags?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then(setFeatures)
      .catch(() => setFeatures({}))
  }, [userId])

  return features
}
```

The same shape works with any backend (Fastify, Hono, Next.js route handlers, Cloudflare Workers, and so on). The only rule is: **never instantiate `FlagraftClient` in browser code**, because that ships your API key to every visitor.

### A reusable singleton

For most apps, one client per process is the right shape. Keep it in a module so the cache is shared.

```ts
// lib/flags.ts
import { FlagraftClient } from '@flagraft/sdk'

export const flags = new FlagraftClient({
  baseUrl: process.env.FLAGRAFT_BASE_URL!,
  apiKey: process.env.FLAGRAFT_KEY!,
  ttl: 60,
})
```

---

## Testing

The SDK accepts a `fetch` override, which makes mocking trivial. Two recipes:

### Inline mock

```ts
import { FlagraftClient } from '@flagraft/sdk'
import { describe, expect, it, vi } from 'vitest'

it('renders the new checkout for users in the experiment', async () => {
  const fakeFetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ name: 'checkout-v2', enabled: true, reason: 'strategy-match' })),
  )

  const flags = new FlagraftClient({
    baseUrl: 'https://test.local',
    apiKey: 'ff_test',
    fetch: fakeFetch as unknown as typeof fetch,
  })

  await expect(flags.isEnabled('checkout-v2')).resolves.toBe(true)
})
```

### `msw` (request-level)

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

server.use(
  http.get('https://flags.example.com/api/v1/client/features/checkout-v2', () =>
    HttpResponse.json({ name: 'checkout-v2', enabled: true, reason: 'strategy-match' }),
  ),
)
```

The SDK's own test suite uses `msw` and is a good reference: see `packages/sdk-js/tests/client.test.ts`.

---

## TypeScript

All types are first-class exports.

```ts
import type {
  EvaluationContext,
  Feature,
  EvaluationResult,
  FlagraftClientOptions,
  ServerErrorBody,
} from '@flagraft/sdk'
import { FlagraftClient, FlagraftError } from '@flagraft/sdk'
```

`tsconfig` requirements:

- `target: ES2022` or newer (the SDK uses `?.`, `??`, top-level `await` is not used internally but works fine).
- `moduleResolution: bundler` or `node16`/`nodenext` for proper ESM/CJS resolution from the dual exports.

---

## Troubleshooting

**`fetch is not defined`** at runtime: you are on Node < 20. Upgrade, or pass a polyfill via the `fetch` option.

**Every call returns `false`**: check that your `apiKey` is a _client_ key, not an admin key. Admin keys get a 403 at `/api/v1/client/*`, which throws `FlagraftError` rather than returning `false`. Wrap a call in a try/catch and inspect the error to confirm.

**Flag changes do not appear**: stale cache. Either lower `ttl`, restart the process, or construct a new `FlagraftClient`. The cache has no public invalidation method by design; the upstream server already invalidates its own cache on writes, so a low SDK TTL is the right knob.

**Tests hang or hit the real network**: pass a custom `fetch` (see "Testing" above), or use `msw` with `onUnhandledRequest: 'error'` so unmocked requests fail loudly.

**Edge runtime build complains about `Response`**: ensure your `tsconfig` `lib` includes `DOM` so `Response` and `RequestInit` resolve. The SDK's own `tsconfig.json` does this.

---

## Compatibility

| Runtime            | Status                                   |
| ------------------ | ---------------------------------------- |
| Node 20+           | Supported (primary target)               |
| Node 18            | Works if `fetch` is polyfilled           |
| Bun                | Supported                                |
| Deno               | Supported via the npm specifier          |
| Cloudflare Workers | Supported                                |
| Vercel Edge        | Supported                                |
| Browser            | Supported, but proxy the key server-side |

---

## License

See the [root repository](../../README.md) for license information.
