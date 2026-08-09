# @flagraft/sdk

The official TypeScript SDK for [Flagraft](../../README.md), a self-hosted feature flag service. The SDK gives your application a typed, cached, fail-safe client for evaluating flags so you do not have to hand-roll HTTP calls, retry logic, or local caching.

> Built for Node 20+, modern bundlers, and edge runtimes that ship `globalThis.fetch`. Ships as dual CommonJS and ESM with full `.d.ts` declarations.

---

## Why use the SDK?

- **Safe by default.** Failures resolve to a default you choose (`false` unless you say otherwise) so a flag check never crashes your request handler.
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
  staleTtl: 300,
  timeoutMs: 2000,
  onStale: ({ flagKey, fetchedAt }) => logger.warn({ flagKey, fetchedAt }, 'stale flag'),
  fetch: globalThis.fetch,
})
```

| Option      | Type                      | Default            | Description                                                                                                         |
| ----------- | ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`   | `string`                  | (required)         | Base URL of the Flagraft server. Trailing slashes are normalized away. The SDK appends `/api/v1/...` itself.        |
| `apiKey`    | `string`                  | (required)         | A client API key. Sent as the raw `Authorization` header value (no `Bearer` prefix), matching the Flagraft auth.    |
| `ttl`       | `number`                  | `30`               | SDK-side cache TTL in **seconds**. Set to `0` to bypass the SDK cache (the server still has its own cache).         |
| `staleTtl`  | `number`                  | `300`              | How long, in **seconds**, an expired value stays usable as a fallback when a refetch fails. `0` disables it.        |
| `timeoutMs` | `number`                  | `2000`             | How long one HTTP request may take before it is aborted, in **milliseconds**. Set to `0` to wait forever.           |
| `onStale`   | `(e: StaleEvent) => void` | `console.warn`     | Called with `{ flagKey, fetchedAt }` whenever a stale value is served. Use it to log structurally or emit a metric. |
| `fetch`     | `typeof fetch`            | `globalThis.fetch` | Optional `fetch` override. Useful for tests (with `msw`), custom transports, or environments without a global.      |

> **Units:** `ttl` and `staleTtl` are seconds; `timeoutMs` is milliseconds and says so in its name. A timeout worth setting is often sub-second, which seconds cannot express cleanly, so the two units are deliberate rather than an oversight.

---

## Authentication

Flagraft has three key tiers (root admin, project admin, client). The SDK only works with **client keys** because the evaluation routes (`/api/v1/client/*`) reject everything else with `403 Forbidden`. Issue a client key from an admin context, scoped to the project and environment your app evaluates against.

The SDK sets the `Authorization` header to the raw key value. Do not prepend `Bearer` or any other scheme.

---

## API reference

### `isEnabled(flagKey, context?, defaultValue?) => Promise<boolean>`

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

// Kill switch whose safe state is "on"
if (await flags.isEnabled('payments-enabled', {}, true)) {
  // ...
}
```

Both trailing arguments are optional. See [`EvaluationContext`](#evaluationcontext) for targeting and [Default values](#default-values) for the third argument.

**Behaviour:**

- Returns `true` or `false` based on the server's evaluation, which considers whether the flag is enabled in the environment and whether any of its targeting strategies match the context.
- Returns `defaultValue` (default `false`) if the flag does not exist (the server responds 404), and remembers that for 5 seconds. See [Unknown flags](#unknown-flags).
- Never waits longer than `timeoutMs` (default 2000ms) on the network. See [Timeouts](#timeouts).
- Treats a `429` as an outage rather than an error, and pauses further requests for the server's `Retry-After`. See [Rate limiting](#rate-limiting).
- On any other failure, returns the **last known value** for that flag and context if one is still inside the stale window, and notifies `onStale`. See [Stale-on-error](#stale-on-error).
- With no stale value available: returns `defaultValue` and logs a warning to `console.warn` if the request failed entirely (network down, DNS error, server unreachable, abort).
- With no stale value available: throws `FlagraftError` on any other 4xx or 5xx response, so misconfiguration (bad key, scope mismatch, server bug) surfaces loudly during integration. `defaultValue` does not suppress this.

#### Default values

The third argument is what you get when the server **cannot answer** — an unknown flag, an unreachable server, a timed-out request. It defaults to `false`, which is right for the common case: a flag gating a new code path should stay off if Flagraft is down.

It is wrong for the opposite case. A kill switch like `payments-enabled` guards the path you would fall back to anyway, so failing it closed disables payments during an unrelated Flagraft outage:

```ts
// Wrong: a Flagraft blip stops payments
if (await flags.isEnabled('payments-enabled')) { ... }

// Right: a Flagraft blip changes nothing
if (await flags.isEnabled('payments-enabled', {}, true)) { ... }
```

Rule of thumb: the default should be whatever the system did **before the flag existed**.

Three things it deliberately does not do:

- **It never overrides a real answer.** If the server says `false`, you get `false`, whatever the default.
- **It loses to a stale value.** A reading you actually fetched, even a few minutes old, beats a static guess. See [Stale-on-error](#stale-on-error).
- **It does not swallow HTTP errors.** A 403 or 500 with no stale value still throws, so a bad key stays loud instead of hiding behind a plausible-looking `true`.

The default is per call, not per client, because different flags have different safe states. It is also not part of any cache key — the SDK caches the server's answer, so two call sites can pass different defaults for the same flag and each gets its own.

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

### Size cap

The cache holds at most **10,000 entries**. Because the cache key includes the whole evaluation context, an app that passes a per-user context creates one entry per user, so an uncapped cache would grow for the life of the process. Once the cap is reached, the oldest-written entry is dropped to make room. This is drop-oldest rather than true LRU, which is indistinguishable in practice at a 30-second TTL.

### Unknown flags

A flag the server does not have answers `404`, which `isEnabled` reports as `false`. That answer is cached too, keyed by flag key alone, for a fixed **5 seconds**.

Without it, the one question guaranteed to repeat forever — a mistyped key, a flag deleted during cleanup, or code deployed before someone created the flag — would make an HTTP round trip on **every single call**, since only successful lookups were being remembered. On a endpoint serving 2 requests a second that is 120 requests a minute against a server whose default rate limit is 100 per minute per IP. Exhaust that budget and the server starts returning `429` to _every_ flag call from that host, so one typo takes down flags that were spelled correctly.

The entry is keyed by flag key with **no context**, because whether a flag exists never depends on who is asking. One entry covers every caller, which matters precisely when the calling code passes a per-user context.

Five seconds is much shorter than `ttl` on purpose, and it is not an option. The common cause of a 404 is code that shipped ahead of the flag being created, and you want the app to notice within seconds once it appears — that lag is the one cost of caching the miss, and no application needs a different number for it. Setting `ttl: 0` switches this cache off along with the others.

### Stale-on-error

When a value's TTL expires, the SDK does not immediately forget it. It keeps the value for a further `staleTtl` seconds (default `300`) and serves it **only if a refetch fails**. A fresh value always wins; the stale copy is a fallback, never a first choice.

```
00:00  fetch ok       -> true   (fresh)
00:30  ttl expires
00:31  server down    -> true   (stale, onStale fires)
05:30  staleTtl expires, entry dropped
05:31  server down    -> false  (default)
```

Without this, a five-minute Flagraft outage silently flips **every flag in your app off** the moment its TTL lapses. "Possibly a few minutes out of date" beats "definitely wrong". Set `staleTtl: 0` to opt out and go back to failing to the default immediately.

**The one case to think about** is a kill switch. If you turn `payments-enabled` off _during_ an outage that also makes Flagraft unreachable, your app keeps reading the cached `true` until the stale window closes. Shorten `staleTtl` if that risk outweighs the outage protection for your workload.

Staleness is reported through `onStale`, which receives the flag key (`null` for `getAllFeatures`) and the value's age in milliseconds. Wire it to your logger or metrics so "we ran on stale flags all afternoon" is visible rather than buried in a `console.warn`.

```ts
const flags = new FlagraftClient({
  baseUrl,
  apiKey,
  onStale: ({ flagKey, fetchedAt }) => {
    logger.warn({ flagKey, fetchedAt }, 'flagraft: serving stale flag')
    metrics.increment('flags.stale')
  },
})
```

---

## Rate limiting

The Flagraft server rate-limits the evaluation routes **per IP** (`RATE_LIMIT_MAX`, default 100 per minute), so every client in one process — indeed every process on one host — shares a single budget. When that budget runs out the server answers `429` with a `Retry-After` header.

The SDK does two things with that.

**It does not throw.** A 429 is the server asking you to slow down, not a bug in your code. It is treated like any other outage: stale value if one is available, otherwise your `defaultValue`. Previously this was the one routine server condition that could throw an exception into a caller's request path — and the cruel part was the timing, since a rate limit arrives exactly when traffic is heaviest.

**It stops sending.** On a 429 the client reads `Retry-After` and sends nothing at all until that moment passes; calls during the quiet period resolve immediately from stale or default with no network at all. Retrying into a rate limiter is precisely what deepens the hole, so there are no retries here — only a pause.

```
request  -> 429, Retry-After: 30
             backoff until +30s, warn logged once
call     -> stale or default, no request sent
call     -> stale or default, no request sent
   ...30s later...
call     -> request sent again
```

`Retry-After` is accepted in both forms HTTP allows, a number of seconds or an absolute date. A missing or unparseable header falls back to a **5 second** pause, and any value is capped at **60 seconds** so one bad header from a proxy cannot mute the client for hours. None of these are options — a correct backoff schedule is not something an application should have to tune.

The warning is logged once when the backoff starts, not on every suppressed call. A rate limit coincides with peak traffic, and a per-call warning would flood the log it is meant to inform.

> The most common cause of hitting the limit is not real load. It is a flag key that does not exist being checked in a hot path — see [Unknown flags](#unknown-flags), which caches that case specifically to stop it.

---

## Timeouts

Every request carries an `AbortSignal.timeout(timeoutMs)`, default **2000ms**. Without one, an unresponsive Flagraft server does not fail — it simply never answers, and the `await` in your request handler hangs for as long as the socket stays open. That is the one failure mode a "fail-safe" flag client must not have, because no amount of fallback logic runs if control never returns.

A timed-out request is treated exactly like a network failure: it tries the stale value first, then falls back to the default.

```ts
const flags = new FlagraftClient({ baseUrl, apiKey, timeoutMs: 500 })
```

A fresh signal is created per request, since `AbortSignal.timeout` starts counting the moment it is constructed — a shared one would fire early and abort healthy requests.

**Choosing a value.** The server answers evaluations from its own in-memory cache, so a healthy response is single-digit milliseconds. The default of 2000ms is a generous ceiling that only trips on a genuinely stuck server, not on ordinary latency. Lower it if flag checks sit on a latency-critical path; raise it if you run Flagraft across a slow link. `timeoutMs: 0` disables the abort entirely and restores the old wait-forever behaviour.

> On a runtime without `AbortSignal.timeout` (Node 18 with only a `fetch` polyfill, for instance), the SDK sends no signal rather than crashing. You get no timeout there, so upgrade to Node 20+ if you need one.

---

## Error model

Any failure is first offered to the stale fallback. The table below describes what happens when **no stale value is available** — because the call is the first one, or the stale window has closed.

| Condition                         | Behaviour                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Server returns 200                | Result returned, cached for `ttl` seconds.                                                                                            |
| Request exceeds `timeoutMs`       | Aborted, then treated as a network failure (stale first, then the default).                                                           |
| Network failure / fetch rejects   | `isEnabled` returns `defaultValue`, logs `console.warn`. `getFeatures` and `getAllFeatures` return `{}` / `[]`.                       |
| Server returns 404 (`isEnabled`)  | Returns `defaultValue` and remembers the miss for 5 seconds. Never served stale — an unknown flag is an answer, not an outage.        |
| Server returns 429 (rate limited) | Treated as an outage: stale first, then `defaultValue`. **Never throws**, and starts a backoff — see [Rate limiting](#rate-limiting). |
| Server returns 4xx (other)        | Throws `FlagraftError` with status, code, message.                                                                                    |
| Server returns 5xx                | Throws `FlagraftError`.                                                                                                               |

The split between "swallow" and "throw" is deliberate. Network blips, timeouts and rate limits are routine operational conditions, and a flag check should never wedge a request over one. A 403 on a cold client means your key or scope is wrong, and you want to know about that loudly.

Note that a stale value can only exist after a successful call, so a misconfigured key still throws on the first request during integration. Once a client has warmed up, a later 403 or 500 is treated as an outage and rides on the stale value until the window closes.

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
      new Response(
        JSON.stringify({ name: 'checkout-v2', enabled: true, reason: 'strategy-match' }),
      ),
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

**Flag changes do not appear**: stale cache. Either lower `ttl`, restart the process, or construct a new `FlagraftClient`. The cache has no public invalidation method; the upstream server already invalidates its own cache on writes, so a low SDK TTL is the right knob.

**Flags look frozen at an old state during an incident**: that is `staleTtl` doing its job — the server is unreachable and the SDK is serving the last known-good values. Wire up `onStale` to see it happening, and lower `staleTtl` (or set it to `0`) if your app would rather fail to defaults.

**A flag you just created still reads `false`**: the SDK cached the 404 from before it existed. It clears itself within 5 seconds. If it persists beyond that, the flag key or the key's environment scope does not match what you created.

**`rate limited, pausing requests for Ns` in your logs**: the server's per-IP budget is exhausted and the SDK has stopped sending until it resets. Flags fall back to stale values or their defaults meanwhile. Check for a flag key checked in a hot path that does not exist, raise `RATE_LIMIT_MAX` on the server, or increase `ttl` so fewer calls reach the network.

**Flag checks fail after ~2 seconds under load**: requests are hitting `timeoutMs`. Confirm the server is healthy and reachable, then raise `timeoutMs` if the latency is genuine rather than a stuck connection.

**`TimeoutError: The operation was timed out`** in your logs: the abort fired. The SDK swallows it and falls back (stale, then the default), so this is a warning about server health, not a crash.

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
