# Phase 4: TypeScript SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@flagraft/sdk`, a first-party TypeScript client for the Flagraft evaluation API, with a built-in TTL cache, safe error handling, and full test coverage.

**Architecture:** Convert the repo into a pnpm workspace. Add a new `packages/sdk-js` package built with tsup (dual CJS + ESM, declaration files). The SDK exposes a `FlagraftClient` class that wraps the two client routes (`GET /api/v1/client/features`, `GET /api/v1/client/features/:flagKey`) using `fetch`. A small in-memory TTL cache keyed by `${flagKey}:${sortedContextJSON}` reduces network chatter. Network failures resolve to `false` so flag lookups never throw at the call site; HTTP 4xx surfaces as a typed `FlagraftError`. Tests use `msw` to mock the server.

**Tech Stack:** pnpm workspaces, TypeScript 5.7, tsup, Vitest, msw, native `fetch` (Node 20+).

---

## API Contract Reference

The SDK targets the existing client routes in `src/modules/client/client.routes.ts`:

- **Auth:** `Authorization: <plaintext-api-key>` header (no `Bearer` prefix). See `src/plugins/auth.ts:78-91`.
- **`GET /api/v1/client/features`** with optional context query params (e.g. `?userId=u1&sessionId=s2`). Returns `{ features: Array<{ name: string; enabled: boolean }> }`.
- **`GET /api/v1/client/features/:flagKey`** with same query. Returns `{ name: string; enabled: boolean; reason: 'override' | 'default' }`. 404 when the flag is unknown.
- **Error envelope:** `{ error: string; message: string; statusCode: number }` (see `src/plugins/errorHandler.ts:39-45`).
- **Rate limit:** 429 uses the same envelope shape (`src/modules/client/client.routes.ts:33-37`).

---

## File Structure

**Workspace setup**

- `pnpm-workspace.yaml` (create) lists `packages/*` and root.
- Root `package.json` (modify) adds `packageManager` if missing, keeps existing scripts.
- `.github/workflows/ci.yml` (modify) adds SDK build + test steps.

**SDK package (`packages/sdk-js/`)**

- `packages/sdk-js/package.json` (create): name `@flagraft/sdk`, dual CJS/ESM exports, build/test/typecheck scripts.
- `packages/sdk-js/tsconfig.json` (create): extends a minimal config; targets ES2022, declaration on.
- `packages/sdk-js/tsup.config.ts` (create): entry `src/index.ts`, formats cjs+esm, dts true, clean, target node20.
- `packages/sdk-js/vitest.config.ts` (create): test environment node, includes `tests/**/*.test.ts`.
- `packages/sdk-js/src/index.ts` (create): re-exports public API (`FlagraftClient`, `FlagraftError`, types).
- `packages/sdk-js/src/types.ts` (create): `EvaluationContext`, `Feature`, `EvaluationResult`, `FlagraftClientOptions`.
- `packages/sdk-js/src/errors.ts` (create): `FlagraftError` class plus `ServerErrorBody` type.
- `packages/sdk-js/src/cache.ts` (create): `TtlCache` with `get`/`set`/`delete`/`clear`, key helper `makeKey`.
- `packages/sdk-js/src/client.ts` (create): `FlagraftClient` class; uses `cache.ts` and `errors.ts`.
- `packages/sdk-js/tests/cache.test.ts` (create): unit tests for cache behaviour and key stability.
- `packages/sdk-js/tests/client.test.ts` (create): integration tests using msw against `FlagraftClient`.
- `packages/sdk-js/tests/setup.ts` (create): msw server lifecycle hooks.
- `packages/sdk-js/README.md` (create): install, quickstart, API reference.

**Documentation**

- `README.md` (modify) adds a "Client SDKs" section linking to the package.

---

## Task 1: Convert repo to a pnpm workspace

**Files:**

- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root) `eslint.config.ts` (root, only if needed for ignore)
- Modify: `.gitignore` (add `packages/*/dist`)

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - '.'
  - 'packages/*'
```

- [ ] **Step 2: Add `packages/*/dist` and `packages/*/node_modules` to `.gitignore`**

Append:

```
packages/*/dist
packages/*/node_modules
```

- [ ] **Step 3: Verify root install still works**

Run: `pnpm install`
Expected: completes without errors; `pnpm-lock.yaml` may update minimally.

- [ ] **Step 4: Verify existing tests still pass**

Run: `pnpm test`
Expected: PASS (no behavioural change).

---

## Task 2: Scaffold `@flagraft/sdk` package

**Files:**

- Create: `packages/sdk-js/package.json`
- Create: `packages/sdk-js/tsconfig.json`
- Create: `packages/sdk-js/tsup.config.ts`
- Create: `packages/sdk-js/vitest.config.ts`
- Create: `packages/sdk-js/src/index.ts` (placeholder)
- Create: `packages/sdk-js/.gitignore`

- [ ] **Step 1: Write `packages/sdk-js/package.json`**

```json
{
  "name": "@flagraft/sdk",
  "version": "0.0.1",
  "description": "TypeScript SDK for Flagraft feature flags",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "msw": "^2.6.6",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/sdk-js/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"],
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*", "tests/**/*", "*.config.ts"]
}
```

Note: `lib: ["ES2022", "DOM"]` is required so the TypeScript compiler resolves the `fetch`, `Response`, and `RequestInit` globals provided by Node 20+.

- [ ] **Step 3: Write `packages/sdk-js/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
})
```

- [ ] **Step 4: Write `packages/sdk-js/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 5: Write placeholder `packages/sdk-js/src/index.ts`**

```ts
export const VERSION = '0.0.1'
```

- [ ] **Step 6: Write `packages/sdk-js/.gitignore`**

```
dist
node_modules
```

- [ ] **Step 7: Install workspace dependencies**

Run: `pnpm install`
Expected: installs `msw`, `tsup`, `typescript`, `vitest` for the new package; lockfile updates.

- [ ] **Step 8: Verify build runs**

Run: `pnpm --filter @flagraft/sdk build`
Expected: produces `packages/sdk-js/dist/index.js`, `index.cjs`, `index.d.ts`.

---

## Task 3: Define public types

**Files:**

- Create: `packages/sdk-js/src/types.ts`
- Modify: `packages/sdk-js/src/index.ts`

- [ ] **Step 1: Write `packages/sdk-js/src/types.ts`**

```ts
export type EvaluationContext = Record<string, string>

export interface Feature {
  name: string
  enabled: boolean
}

export interface EvaluationResult {
  name: string
  enabled: boolean
  reason: 'override' | 'default'
}

export interface FlagraftClientOptions {
  baseUrl: string
  apiKey: string
  /** Cache TTL in seconds. Set to 0 to disable. Defaults to 30. */
  ttl?: number
  /** Optional fetch override for testing or custom transports. */
  fetch?: typeof fetch
}
```

- [ ] **Step 2: Re-export from `packages/sdk-js/src/index.ts`**

Replace contents with:

```ts
export type {
  EvaluationContext,
  Feature,
  EvaluationResult,
  FlagraftClientOptions,
} from './types.js'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @flagraft/sdk typecheck`
Expected: no errors.

---

## Task 4: Implement `FlagraftError`

**Files:**

- Create: `packages/sdk-js/src/errors.ts`
- Create: `packages/sdk-js/tests/errors.test.ts`
- Modify: `packages/sdk-js/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/sdk-js/tests/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FlagraftError } from '../src/errors.js'

describe('FlagraftError', () => {
  it('preserves status, code, and message', () => {
    const err = new FlagraftError('Forbidden', 403, 'Forbidden')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('FlagraftError')
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('Forbidden')
    expect(err.message).toBe('Forbidden')
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter @flagraft/sdk test`
Expected: FAIL (`Cannot find module '../src/errors.js'`).

- [ ] **Step 3: Implement `errors.ts`**

```ts
export interface ServerErrorBody {
  error: string
  message: string
  statusCode: number
}

export class FlagraftError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'FlagraftError'
  }
}
```

- [ ] **Step 4: Re-export from `index.ts`**

Append:

```ts
export { FlagraftError } from './errors.js'
export type { ServerErrorBody } from './errors.js'
```

- [ ] **Step 5: Run test to confirm pass**

Run: `pnpm --filter @flagraft/sdk test`
Expected: PASS.

---

## Task 5: Implement TTL cache

**Files:**

- Create: `packages/sdk-js/src/cache.ts`
- Create: `packages/sdk-js/tests/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/sdk-js/tests/cache.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TtlCache, makeKey } from '../src/cache.js'

describe('makeKey', () => {
  it('produces a stable key regardless of context property order', () => {
    const a = makeKey('flag-1', { userId: 'u1', sessionId: 's2' })
    const b = makeKey('flag-1', { sessionId: 's2', userId: 'u1' })
    expect(a).toBe(b)
  })

  it('differentiates flag keys', () => {
    expect(makeKey('a', {})).not.toBe(makeKey('b', {}))
  })
})

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns set values within ttl', () => {
    const cache = new TtlCache<number>(30)
    cache.set('k', 1)
    expect(cache.get('k')).toBe(1)
  })

  it('returns undefined after ttl expires', () => {
    const cache = new TtlCache<number>(1)
    cache.set('k', 1)
    vi.advanceTimersByTime(1500)
    expect(cache.get('k')).toBeUndefined()
  })

  it('treats ttl=0 as disabled (set is a no-op)', () => {
    const cache = new TtlCache<number>(0)
    cache.set('k', 1)
    expect(cache.get('k')).toBeUndefined()
  })

  it('clear removes all entries', () => {
    const cache = new TtlCache<number>(30)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter @flagraft/sdk test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `cache.ts`**

```ts
import type { EvaluationContext } from './types.js'

export function makeKey(flagKey: string, context: EvaluationContext): string {
  const sorted = Object.keys(context)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = context[k]
      return acc
    }, {})
  return `${flagKey}:${JSON.stringify(sorted)}`
}

interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>()
  private readonly ttlMs: number

  constructor(ttlSeconds: number) {
    this.ttlMs = Math.max(0, ttlSeconds) * 1000
  }

  get(key: string): T | undefined {
    if (this.ttlMs === 0) return undefined
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    if (this.ttlMs === 0) return
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @flagraft/sdk test`
Expected: PASS.

---

## Task 6: Add msw test setup

**Files:**

- Create: `packages/sdk-js/tests/setup.ts`
- Create: `packages/sdk-js/tests/msw-server.ts`

- [ ] **Step 1: Write `tests/msw-server.ts`**

```ts
import { setupServer } from 'msw/node'

export const mswServer = setupServer()
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import { afterAll, afterEach, beforeAll } from 'vitest'
import { mswServer } from './msw-server.js'

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())
```

- [ ] **Step 3: Verify existing tests still pass with the setup loaded**

Run: `pnpm --filter @flagraft/sdk test`
Expected: PASS (no new tests yet; previous tests unaffected).

---

## Task 7: Implement `FlagraftClient.isEnabled`

**Files:**

- Create: `packages/sdk-js/src/client.ts`
- Create: `packages/sdk-js/tests/client.test.ts`
- Modify: `packages/sdk-js/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/sdk-js/tests/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter @flagraft/sdk test`
Expected: FAIL (module `../src/client.js` not found).

- [ ] **Step 3: Implement `client.ts` (isEnabled only for now; rest stubbed)**

```ts
import { TtlCache, makeKey } from './cache.js'
import { FlagraftError, type ServerErrorBody } from './errors.js'
import type {
  EvaluationContext,
  EvaluationResult,
  Feature,
  FlagraftClientOptions,
} from './types.js'

const DEFAULT_TTL_SECONDS = 30

export class FlagraftClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly singleCache: TtlCache<EvaluationResult>
  private readonly bulkCache: TtlCache<Feature[]>

  constructor(options: FlagraftClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? globalThis.fetch
    const ttl = options.ttl ?? DEFAULT_TTL_SECONDS
    this.singleCache = new TtlCache<EvaluationResult>(ttl)
    this.bulkCache = new TtlCache<Feature[]>(ttl)
  }

  async isEnabled(flagKey: string, context: EvaluationContext = {}): Promise<boolean> {
    const cacheKey = makeKey(flagKey, context)
    const cached = this.singleCache.get(cacheKey)
    if (cached) return cached.enabled

    try {
      const result = await this.fetchSingle(flagKey, context)
      this.singleCache.set(cacheKey, result)
      return result.enabled
    } catch (error) {
      if (error instanceof FlagraftError) {
        if (error.statusCode === 404) return false
        throw error
      }
      // eslint-disable-next-line no-console
      console.warn('[flagraft] flag evaluation failed, defaulting to false', error)
      return false
    }
  }

  private async fetchSingle(
    flagKey: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const url = `${this.baseUrl}/api/v1/client/features/${encodeURIComponent(flagKey)}${this.queryString(context)}`
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: this.apiKey },
    })
    if (!response.ok) {
      await this.throwFromResponse(response)
    }
    return (await response.json()) as EvaluationResult
  }

  private queryString(context: EvaluationContext): string {
    const entries = Object.entries(context)
    if (entries.length === 0) return ''
    const params = new URLSearchParams()
    for (const [k, v] of entries) params.set(k, v)
    return `?${params.toString()}`
  }

  private async throwFromResponse(response: Response): Promise<never> {
    let body: ServerErrorBody | undefined
    try {
      body = (await response.json()) as ServerErrorBody
    } catch {
      // body was not JSON; fall through with a synthetic envelope
    }
    throw new FlagraftError(
      body?.message ?? response.statusText,
      response.status,
      body?.error ?? 'HttpError',
    )
  }
}
```

- [ ] **Step 4: Re-export `FlagraftClient` from `index.ts`**

Append:

```ts
export { FlagraftClient } from './client.js'
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `pnpm --filter @flagraft/sdk test`
Expected: PASS for all `client.test.ts` cases written so far.

---

## Task 8: Implement `getFeatures` and `getAllFeatures`

**Files:**

- Modify: `packages/sdk-js/src/client.ts`
- Modify: `packages/sdk-js/tests/client.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `client.test.ts`:

```ts
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
```

Note: `vi.useFakeTimers()` must be inside the test body because msw's request handling relies on real timers at module load.

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter @flagraft/sdk test`
Expected: FAIL (`client.getFeatures is not a function`).

- [ ] **Step 3: Add methods to `client.ts`**

Inside `FlagraftClient`, add:

```ts
async getFeatures(context: EvaluationContext = {}): Promise<Record<string, boolean>> {
  const features = await this.getAllFeatures(context)
  return features.reduce<Record<string, boolean>>((acc, f) => {
    acc[f.name] = f.enabled
    return acc
  }, {})
}

async getAllFeatures(context: EvaluationContext = {}): Promise<Feature[]> {
  const cacheKey = makeKey('__all__', context)
  const cached = this.bulkCache.get(cacheKey)
  if (cached) return cached

  try {
    const features = await this.fetchAll(context)
    this.bulkCache.set(cacheKey, features)
    return features
  } catch (error) {
    if (error instanceof FlagraftError) throw error
    // eslint-disable-next-line no-console
    console.warn('[flagraft] bulk evaluation failed, returning empty list', error)
    return []
  }
}

private async fetchAll(context: EvaluationContext): Promise<Feature[]> {
  const url = `${this.baseUrl}/api/v1/client/features${this.queryString(context)}`
  const response = await this.fetchImpl(url, {
    method: 'GET',
    headers: { authorization: this.apiKey },
  })
  if (!response.ok) {
    await this.throwFromResponse(response)
  }
  const body = (await response.json()) as { features: Feature[] }
  return body.features
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @flagraft/sdk test`
Expected: PASS.

---

## Task 9: Wire SDK into root scripts and CI

**Files:**

- Modify: `package.json` (root)
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update root `package.json` scripts**

Replace the existing build/test/typecheck/lint scripts so they include the workspace. For instance:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "build:all": "pnpm -r --parallel build",
    "start": "node dist/server.cjs",
    "typecheck": "tsc --noEmit",
    "typecheck:all": "pnpm -r --parallel typecheck",
    "test": "vitest run",
    "test:all": "pnpm -r --parallel test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "admin:create-root-key": "tsx src/cli/create-root-key.ts",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 2: Add SDK steps to CI**

In `.github/workflows/ci.yml`, add a new job after `build`:

```yaml
sdk:
  name: SDK
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 10

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - run: pnpm install --frozen-lockfile

    - run: pnpm --filter @flagraft/sdk typecheck

    - run: pnpm --filter @flagraft/sdk test

    - run: pnpm --filter @flagraft/sdk build
```

- [ ] **Step 3: Run full local verification**

Run: `pnpm install && pnpm test:all && pnpm --filter @flagraft/sdk build`
Expected: all jobs PASS; SDK `dist/` is produced.

---

## Task 10: Documentation

**Files:**

- Create: `packages/sdk-js/README.md`
- Modify: `README.md` (root)

- [ ] **Step 1: Write `packages/sdk-js/README.md`**

```markdown
# @flagraft/sdk

TypeScript SDK for [Flagraft](../../README.md) feature flags. First-party client with a built-in TTL cache and safe fallback semantics.

## Install

\`\`\`bash
pnpm add @flagraft/sdk
\`\`\`

## Quickstart

\`\`\`ts
import { FlagraftClient } from '@flagraft/sdk'

const flags = new FlagraftClient({
baseUrl: 'https://flags.example.com',
apiKey: process.env.FLAGRAFT_KEY!,
ttl: 30,
})

if (await flags.isEnabled('checkout-v2', { userId: 'u_42' })) {
// render the new checkout
}
\`\`\`

## API

### `new FlagraftClient(options)`

| Option  | Type     | Default          | Description                                           |
| ------- | -------- | ---------------- | ----------------------------------------------------- |
| baseUrl | string   | (required)       | Base URL of the Flagraft server.                      |
| apiKey  | string   | (required)       | A client API key issued by an admin.                  |
| ttl     | number   | 30               | Cache TTL in seconds. Set to 0 to disable caching.    |
| fetch   | function | globalThis.fetch | Optional fetch override (testing, custom transports). |

### `isEnabled(flagKey, context?)`

Returns `Promise<boolean>`. Returns `false` on network failure or when the flag is unknown (404). Throws `FlagraftError` for other 4xx responses.

### `getFeatures(context?)`

Returns `Promise<Record<string, boolean>>`. Useful for hydrating a UI in one call.

### `getAllFeatures(context?)`

Returns `Promise<Array<{ name: string; enabled: boolean }>>`. The raw response shape.

## Error model

Network failures resolve to a safe `false` so flag checks never throw at the call site. HTTP 4xx other than 404 surface as `FlagraftError` with `statusCode` and `code` properties matching the server error envelope.

## Caching

Single-flag and bulk responses are cached separately. The cache key includes a stable JSON serialization of the context object so callers do not have to worry about property ordering.
```

(Note: keep the example fenced blocks as triple backticks in the actual file; they are escaped here only because this plan is itself markdown.)

- [ ] **Step 2: Add a "Client SDKs" section to root `README.md`**

Append after the existing "Architecture" or "Usage" section:

```markdown
## Client SDKs

- **TypeScript / JavaScript:** [`@flagraft/sdk`](packages/sdk-js/README.md)
```

- [ ] **Step 3: Verify formatting**

Run: `pnpm format:check`
Expected: PASS.

---

## Final Verification

- [ ] **All tests pass across the workspace**

Run: `pnpm test:all`
Expected: PASS.

- [ ] **Typecheck passes**

Run: `pnpm typecheck && pnpm --filter @flagraft/sdk typecheck`
Expected: PASS.

- [ ] **Lint and format clean**

Run: `pnpm lint && pnpm format:check`
Expected: PASS.

- [ ] **SDK builds with declaration files present**

Run: `pnpm --filter @flagraft/sdk build && ls packages/sdk-js/dist`
Expected: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts` all present.

- [ ] **Mark Phase 4 complete in `docs/ROADMAP.md`**

Tick all Phase 4 checkboxes in the roadmap.

---

## Notes for the implementer

- **No emdashes** in any generated content (org instruction).
- **Authorization header is the raw key**, not `Bearer <key>`. See `src/plugins/auth.ts:78-91`.
- **Network failure vs HTTP error:** the SDK swallows transport errors and returns a safe default; HTTP error envelopes from the server are typed and rethrown (except 404 on `isEnabled`).
- **Why two caches:** single-flag and bulk endpoints return different shapes; using one cache would force tagged unions and brittle key collisions. Two small caches keep types tight.
- **Why `setupFiles` in vitest config:** msw needs `beforeAll/afterEach/afterAll` hooks registered globally so individual test files only deal with handlers.
- **Future:** percentage rollout and SSE push are explicitly deferred (see roadmap backlog). The `getFeatures` shape is forward-compatible because it returns booleans only, leaving room to add `reason`/`variant` later without breaking callers.
