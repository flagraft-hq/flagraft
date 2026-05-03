# Caching Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-memory BentoCache layer to the client flag evaluation hot path so repeated eval requests skip DB queries, with precise invalidation on admin mutations.

**Architecture:** A `Cache` interface wraps BentoCache (memory driver) and is registered as `fastify.cache` via a Fastify plugin. Client evaluation routes call `service.loadFlagState()` with the cache, which uses `cache.getOrSet()` to serve hits from memory. Mutation services (flags, overrides, environments) accept an optional `cache` parameter appended to their existing signatures and call `cache.delete()` or `cache.deleteByPrefix()` after successful writes. Existing service call sites (including all existing tests) pass no cache and are unaffected.

**Tech Stack:** `bentocache`, `bentocache/drivers/memory`, `fastify-plugin`, Zod (config validation), Vitest (unit + integration tests)

---

## File Map

**Create:**

- `src/cache/index.ts` - `Cache` interface + `createCache(ttlSeconds)` factory
- `src/plugins/cache.ts` - Fastify plugin, decorates `fastify.cache`
- `tests/unit/cache.test.ts` - unit tests for cache hit / miss / delete / deleteByPrefix / TTL

**Modify:**

- `package.json` - add `bentocache` dependency
- `src/config.ts` - add `CACHE_TTL_SECONDS` field (Zod, default 30)
- `.env.example` - document `CACHE_TTL_SECONDS`
- `src/server.ts` - register cache plugin; add `cache?: Cache` to `BuildServerOptions`
- `src/modules/client/client.service.ts` - add optional `cache` to `loadFlagState` and `evaluateOne`
- `src/modules/client/client.routes.ts` - pass `fastify.cache` to service calls
- `src/modules/flags/flag.service.ts` - add optional `cache` to `createFlag`, `deleteFlag`, `setFlagEnabled`
- `src/modules/flags/flag.routes.ts` - pass `fastify.cache` to mutation calls
- `src/modules/flags/override.service.ts` - add optional `cache` to `createOverride`, `deleteOverride`
- `src/modules/flags/override.routes.ts` - pass `fastify.cache` to mutation calls
- `src/modules/environments/environment.service.ts` - add optional `cache` to `deleteEnvironment`
- `src/modules/environments/environment.routes.ts` - pass `fastify.cache` to delete call
- `tests/integration/cache.test.ts` - integration tests: mutation invalidation + TTL

---

## Cache Key Design

| Trigger                           | Cache key affected                                                     |
| --------------------------------- | ---------------------------------------------------------------------- |
| `loadFlagState(projectId, envId)` | read/write `flags:${projectId}:${envId}`                               |
| `createFlag` (affects all envs)   | deleteByPrefix `flags:${projectId}:`                                   |
| `deleteFlag` (affects all envs)   | deleteByPrefix `flags:${projectId}:`                                   |
| `setFlagEnabled(envSlug)`         | delete `flags:${projectId}:${env.id}` (id from DB lookup already done) |
| `createOverride(envSlug)`         | delete `flags:${projectId}:${env.id}` (id from DB lookup already done) |
| `deleteOverride(envSlug)`         | delete `flags:${projectId}:${env.id}` (id from DB lookup already done) |
| `deleteEnvironment(envId)`        | deleteByPrefix `flags:${projectId}:`                                   |

`patchFlag` (name/description only) does not affect evaluation state -- no cache action needed.

---

## Task 1: Install bentocache and add CACHE_TTL_SECONDS to config

**Files:**

- Modify: `package.json`
- Modify: `src/config.ts`
- Modify: `.env.example`
- Modify: `tests/config.test.ts` (if present, update to cover new field)

- [ ] **Step 1: Install the package**

```bash
pnpm add bentocache
```

After installation, run `node -e "import('bentocache/drivers/memory').then(() => console.log('ok'))"`. If that resolves, the driver is a subpath export and no additional package is needed. If it throws, install the separate driver package: `pnpm add @bentocache/drivers/memory` and adjust the import in `src/cache/index.ts` accordingly.

- [ ] **Step 2: Write failing config tests for CACHE_TTL_SECONDS**

`tests/config.test.ts` already exists with a `describe('loadConfig', ...)` block. Add these three `it` cases inside that existing block -- do not create a new wrapping `describe`:

```typescript
it('defaults CACHE_TTL_SECONDS to 30', () => {
  const config = loadConfig({ DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft' })
  expect(config.CACHE_TTL_SECONDS).toBe(30)
})

it('accepts a custom CACHE_TTL_SECONDS', () => {
  const config = loadConfig({
    DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
    CACHE_TTL_SECONDS: '60',
  })
  expect(config.CACHE_TTL_SECONDS).toBe(60)
})

it('rejects a non-numeric CACHE_TTL_SECONDS', () => {
  expect(() =>
    loadConfig({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      CACHE_TTL_SECONDS: 'bad',
    }),
  ).toThrow()
})
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
pnpm test tests/config.test.ts
```

Expected: FAIL - `config.CACHE_TTL_SECONDS` is undefined

- [ ] **Step 4: Add CACHE_TTL_SECONDS to src/config.ts**

```typescript
const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(30),
})
```

- [ ] **Step 5: Add CACHE_TTL_SECONDS to .env.example**

Append after `LOG_LEVEL=info`:

```
# Seconds to cache flag evaluation state in memory. Set to 0 to disable caching.
CACHE_TTL_SECONDS=30
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
pnpm test tests/config.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/config.ts .env.example tests/config.test.ts
git commit -m "feat: add bentocache dependency and CACHE_TTL_SECONDS config"
```

---

## Task 2: Create the Cache module

**Files:**

- Create: `src/cache/index.ts`
- Create: `tests/unit/cache.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/cache.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCache } from '../../src/cache/index.js'

describe('createCache', () => {
  it('calls factory once on first access', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue({ data: 'value' })

    const result = await cache.getOrSet('k1', factory)

    expect(result).toEqual({ data: 'value' })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('returns cached value without calling factory on second access', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('fresh')

    await cache.getOrSet('k2', factory)
    const second = await cache.getOrSet('k2', factory)

    expect(second).toBe('fresh')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('calls factory again after delete', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('value')

    await cache.getOrSet('k3', factory)
    await cache.delete('k3')
    await cache.getOrSet('k3', factory)

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('deleteByPrefix removes all matching keys', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('x')

    await cache.getOrSet('project:a:env1', factory)
    await cache.getOrSet('project:a:env2', factory)
    await cache.getOrSet('project:b:env1', factory)

    await cache.deleteByPrefix('project:a:')

    // project:a keys are gone -- factory should be called again
    await cache.getOrSet('project:a:env1', factory)
    await cache.getOrSet('project:a:env2', factory)
    // project:b key still cached -- factory should NOT be called again
    await cache.getOrSet('project:b:env1', factory)

    // 3 initial + 2 re-fetched for project:a = 5
    expect(factory).toHaveBeenCalledTimes(5)
  })

  it('calls factory again after TTL expiry', async () => {
    const cache = createCache(1) // 1-second TTL
    const factory = vi.fn().mockResolvedValue('v')

    await cache.getOrSet('k4', factory)

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100))

    await cache.getOrSet('k4', factory)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test tests/unit/cache.test.ts
```

Expected: FAIL -- `src/cache/index.ts` does not exist

- [ ] **Step 3: Implement src/cache/index.ts**

```typescript
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

export interface Cache {
  getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T>
  delete(key: string): Promise<void>
  deleteByPrefix(prefix: string): Promise<void>
}

export function createCache(ttlSeconds: number): Cache {
  const bento = new BentoCache({
    default: 'memory',
    stores: {
      memory: bentostore().useL1Layer(memoryDriver()),
    },
  })

  const knownKeys = new Set<string>()
  const ttl = `${ttlSeconds}s`

  return {
    async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
      knownKeys.add(key)
      return bento.getOrSet(key, factory, { ttl }) as Promise<T>
    },

    async delete(key: string): Promise<void> {
      knownKeys.delete(key)
      await bento.delete(key)
    },

    async deleteByPrefix(prefix: string): Promise<void> {
      const targets = [...knownKeys].filter((k) => k.startsWith(prefix))
      await Promise.all(targets.map((k) => this.delete(k)))
    },
  }
}
```

> **Note on BentoCache imports:** If the above import for `memoryDriver` fails, check `node_modules/bentocache/package.json` for the correct subpath export. The import path may differ between BentoCache versions (e.g. `bentocache/drivers/memory` vs a separate `@bentocache/node` package).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/unit/cache.test.ts
```

Expected: PASS (the TTL test takes ~1.1s -- that is normal)

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/cache/index.ts tests/unit/cache.test.ts
git commit -m "feat: add Cache interface and BentoCache memory implementation"
```

---

## Task 3: Create the cache Fastify plugin and register it

**Files:**

- Create: `src/plugins/cache.ts`
- Modify: `src/server.ts`

- [ ] **Step 0: Verify fastify-plugin is already installed**

Check `package.json` dependencies -- `fastify-plugin` is already listed (`^4.5.1`). No install needed.

- [ ] **Step 1: Create src/plugins/cache.ts**

```typescript
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { createCache, type Cache } from '../cache/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    cache: Cache
  }
}

export interface CachePluginOptions {
  cache?: Cache
  ttlSeconds?: number
}

async function cachePlugin(fastify: FastifyInstance, opts: CachePluginOptions) {
  const cache = opts.cache ?? createCache(opts.ttlSeconds ?? 30)
  fastify.decorate('cache', cache)
}

export default fp(cachePlugin, { name: 'cache' })
```

- [ ] **Step 2: Modify src/server.ts to register the plugin**

Add the import at the top with the other plugin imports:

```typescript
import cachePlugin from './plugins/cache.js'
import type { Cache } from './cache/index.js'
```

Extend `BuildServerOptions`:

```typescript
export interface BuildServerOptions {
  db?: Db
  cache?: Cache
}
```

Register the plugin in `buildServer` right after `dbPlugin`, before `errorHandlerPlugin`:

```typescript
await fastify.register(cachePlugin, {
  cache: opts.cache,
  ttlSeconds: config.CACHE_TTL_SECONDS,
})
```

Final registration order:

```typescript
await fastify.register(dbPlugin, { db: opts.db, connectionString: config.DATABASE_URL })
await fastify.register(cachePlugin, { cache: opts.cache, ttlSeconds: config.CACHE_TTL_SECONDS })
await fastify.register(errorHandlerPlugin)
await fastify.register(authPlugin)
// ... routes
```

- [ ] **Step 3: Run typecheck to verify declarations are correct**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Run the full test suite to confirm nothing regressed**

```bash
pnpm test
```

Expected: all existing tests PASS (cache is registered but unused at this point)

- [ ] **Step 5: Commit**

```bash
git add src/plugins/cache.ts src/server.ts
git commit -m "feat: register cache Fastify plugin and expose fastify.cache"
```

---

## Task 4: Cache the client evaluation hot path

**Files:**

- Modify: `src/modules/client/client.service.ts`
- Modify: `src/modules/client/client.routes.ts`

This task wires the cache into the two client eval routes. `loadFlagState` gets an optional `cache` param; when provided it uses `cache.getOrSet()`. `evaluateOne` threads cache through to `loadFlagState`. Routes pass `fastify.cache`.

- [ ] **Step 1: Modify src/modules/client/client.service.ts**

Add the `Cache` import at the top:

```typescript
import type { Cache } from '../../cache/index.js'
```

Update `loadFlagState` signature (append `cache` at the end -- existing callers with no cache arg still compile):

```typescript
export async function loadFlagState(
  db: Db,
  projectId: string,
  environmentId: string,
  cache?: Cache,
): Promise<Map<string, FlagEnvironmentState>> {
  const cacheKey = `flags:${projectId}:${environmentId}`

  const load = async (): Promise<Map<string, FlagEnvironmentState>> => {
    const rows = await db
      .select({
        flagKey: featureFlags.key,
        enabled: flagEnvironments.enabled,
      })
      .from(flagEnvironments)
      .innerJoin(featureFlags, eq(featureFlags.id, flagEnvironments.flagId))
      .innerJoin(environments, eq(environments.id, flagEnvironments.environmentId))
      .where(
        and(
          eq(featureFlags.projectId, projectId),
          eq(environments.projectId, projectId),
          eq(flagEnvironments.environmentId, environmentId),
        ),
      )

    const overrides = await db
      .select({
        flagKey: featureFlags.key,
        contextKey: flagOverrides.contextKey,
        contextValue: flagOverrides.contextValue,
        enabled: flagOverrides.enabled,
      })
      .from(flagOverrides)
      .innerJoin(featureFlags, eq(featureFlags.id, flagOverrides.flagId))
      .where(
        and(eq(featureFlags.projectId, projectId), eq(flagOverrides.environmentId, environmentId)),
      )
      .orderBy(flagOverrides.createdAt)

    const state = new Map<string, FlagEnvironmentState>()
    for (const row of rows) {
      state.set(row.flagKey, { enabled: row.enabled, overrides: [] })
    }
    for (const override of overrides) {
      state.get(override.flagKey)?.overrides.push({
        contextKey: override.contextKey,
        contextValue: override.contextValue,
        enabled: override.enabled,
      })
    }
    return state
  }

  if (cache) {
    return cache.getOrSet(cacheKey, load)
  }
  return load()
}
```

Update `evaluateOne` to accept and thread cache:

```typescript
export async function evaluateOne(
  db: Db,
  projectId: string,
  environmentId: string,
  flagKey: string,
  context: EvaluationContext,
  cache?: Cache,
): Promise<EvaluatedFeature> {
  const state = await loadFlagState(db, projectId, environmentId, cache)
  const flagState = state.get(flagKey)
  if (!flagState) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
  return { name: flagKey, ...evaluateFlag(flagState, context) }
}
```

- [ ] **Step 2: Modify src/modules/client/client.routes.ts to pass fastify.cache**

```typescript
export async function clientRoutes(fastify: FastifyInstance) {
  fastify.get('/api/client/features', { preHandler: fastify.requireClientKey }, async (request) => {
    const context = request.keyContext!
    const state = await service.loadFlagState(
      fastify.db,
      context.projectId!,
      context.environmentId!,
      fastify.cache,
    )
    return { features: service.evaluateAll(state, queryToContext(request.query)) }
  })

  fastify.get(
    '/api/client/features/:flagKey',
    { preHandler: fastify.requireClientKey },
    async (request) => {
      const context = request.keyContext!
      const params = flagParamSchema.parse(request.params)
      return service.evaluateOne(
        fastify.db,
        context.projectId!,
        context.environmentId!,
        params.flagKey,
        queryToContext(request.query),
        fastify.cache,
      )
    },
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: all tests PASS (existing integration tests still work because the real cache is injected via the plugin, and the TTL is 30s which does not interfere with test isolation since each test uses a fresh app instance with a fresh cache)

- [ ] **Step 5: Commit**

```bash
git add src/modules/client/client.service.ts src/modules/client/client.routes.ts
git commit -m "feat: cache flag state in client evaluation hot path"
```

---

## Task 5: Invalidate cache on flag mutations

**Files:**

- Modify: `src/modules/flags/flag.service.ts`
- Modify: `src/modules/flags/flag.routes.ts`

Three mutations affect evaluation state: `createFlag` (adds flag to all envs), `deleteFlag` (removes flag from all envs), and `setFlagEnabled` (changes state for one env). `patchFlag` only touches name/description -- no cache action needed.

- [ ] **Step 1: Modify src/modules/flags/flag.service.ts**

Add the import:

```typescript
import type { Cache } from '../../cache/index.js'
```

Update `createFlag` to accept and use cache (all-project invalidation because new flag appears in every environment):

```typescript
export async function createFlag(db: Db, projectId: string, input: CreateFlagInput, cache?: Cache) {
  const flag = await db.transaction(async (tx) => {
    const [newFlag] = await tx
      .insert(featureFlags)
      .values({ ...input, projectId })
      .returning()
    const envs = await tx.select().from(environments).where(eq(environments.projectId, projectId))
    if (envs.length > 0) {
      await tx.insert(flagEnvironments).values(
        envs.map((environment) => ({
          flagId: newFlag.id,
          environmentId: environment.id,
          enabled: false,
        })),
      )
    }
    return newFlag
  })
  await cache?.deleteByPrefix(`flags:${projectId}:`)
  return flag
}
```

Update `deleteFlag`:

```typescript
export async function deleteFlag(db: Db, projectId: string, flagKey: string, cache?: Cache) {
  const [flag] = await db
    .delete(featureFlags)
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .returning()

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
  await cache?.deleteByPrefix(`flags:${projectId}:`)
}
```

Update `setFlagEnabled` -- the `findEnvironment` call already returns `environment.id`, use it:

```typescript
export async function setFlagEnabled(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  enabled: boolean,
  cache?: Cache,
) {
  const flag = await findFlag(db, projectId, flagKey)
  const environment = await findEnvironment(db, projectId, environmentSlug)
  const [row] = await db
    .insert(flagEnvironments)
    .values({ flagId: flag.id, environmentId: environment.id, enabled })
    .onConflictDoUpdate({
      target: [flagEnvironments.flagId, flagEnvironments.environmentId],
      set: { enabled, updatedAt: sql`now()` },
    })
    .returning()
  await cache?.delete(`flags:${projectId}:${environment.id}`)
  return row
}
```

- [ ] **Step 2: Modify src/modules/flags/flag.routes.ts to pass fastify.cache**

Update the three mutation call sites:

```typescript
// createFlag
const flag = await service.createFlag(
  fastify.db,
  params.projectId,
  createFlagSchema.parse(request.body),
  fastify.cache,
)

// deleteFlag
await service.deleteFlag(fastify.db, params.projectId, params.flagKey, fastify.cache)

// setFlagEnabled (both enable and disable)
return service.setFlagEnabled(
  fastify.db,
  params.projectId,
  params.flagKey,
  params.environmentSlug,
  enabled,
  fastify.cache,
)
```

- [ ] **Step 3: Run typecheck + full test suite**

```bash
pnpm typecheck && pnpm test
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/flags/flag.service.ts src/modules/flags/flag.routes.ts
git commit -m "feat: invalidate cache after flag create, delete, and enable/disable"
```

---

## Task 6: Invalidate cache on override mutations

**Files:**

- Modify: `src/modules/flags/override.service.ts`
- Modify: `src/modules/flags/override.routes.ts`

Overrides affect evaluation state for the specific environment they target. The `lookup` helper already resolves both flag and environment -- use `environment.id` for the cache key.

- [ ] **Step 1: Modify src/modules/flags/override.service.ts**

Add the import:

```typescript
import type { Cache } from '../../cache/index.js'
```

Update `createOverride`:

```typescript
export async function createOverride(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  input: CreateOverrideInput,
  cache?: Cache,
) {
  const { flag, environment } = await lookup(db, projectId, flagKey, environmentSlug)
  const [override] = await db
    .insert(flagOverrides)
    .values({
      flagId: flag.id,
      environmentId: environment.id,
      contextKey: input.contextKey,
      contextValue: input.contextValue,
      enabled: input.enabled,
    })
    .returning()
  await cache?.delete(`flags:${projectId}:${environment.id}`)
  return override
}
```

Update `deleteOverride`:

```typescript
export async function deleteOverride(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  overrideId: string,
  cache?: Cache,
) {
  const { flag, environment } = await lookup(db, projectId, flagKey, environmentSlug)
  const [override] = await db
    .delete(flagOverrides)
    .where(
      and(
        eq(flagOverrides.id, overrideId),
        eq(flagOverrides.flagId, flag.id),
        eq(flagOverrides.environmentId, environment.id),
      ),
    )
    .returning()

  if (!override) {
    throw new AppError('Override not found', 404, 'NotFound')
  }
  await cache?.delete(`flags:${projectId}:${environment.id}`)
}
```

- [ ] **Step 2: Modify src/modules/flags/override.routes.ts to pass fastify.cache**

```typescript
// createOverride
const override = await service.createOverride(
  fastify.db,
  params.projectId,
  params.flagKey,
  params.environmentSlug,
  createOverrideSchema.parse(request.body),
  fastify.cache,
)

// deleteOverride
await service.deleteOverride(
  fastify.db,
  params.projectId,
  params.flagKey,
  params.environmentSlug,
  params.overrideId,
  fastify.cache,
)
```

- [ ] **Step 3: Run typecheck + full test suite**

```bash
pnpm typecheck && pnpm test
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/flags/override.service.ts src/modules/flags/override.routes.ts
git commit -m "feat: invalidate cache after override create and delete"
```

---

## Task 7: Invalidate cache on environment deletion

**Files:**

- Modify: `src/modules/environments/environment.service.ts`
- Modify: `src/modules/environments/environment.routes.ts`

Deleting an environment removes all flag states for that environment. Use `deleteByPrefix` to invalidate all project-scoped entries -- `environmentId` is available directly from the route params, but we also have it in the returned record from the delete query.

- [ ] **Step 1: Modify src/modules/environments/environment.service.ts**

Add the import:

```typescript
import type { Cache } from '../../cache/index.js'
```

Update `deleteEnvironment`:

```typescript
export async function deleteEnvironment(
  db: Db,
  projectId: string,
  environmentId: string,
  cache?: Cache,
) {
  const [environment] = await db
    .delete(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
    .returning()

  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }
  await cache?.deleteByPrefix(`flags:${projectId}:`)
}
```

- [ ] **Step 2: Modify src/modules/environments/environment.routes.ts to pass fastify.cache**

```typescript
// deleteEnvironment
await service.deleteEnvironment(fastify.db, params.projectId, params.environmentId, fastify.cache)
```

- [ ] **Step 3: Run typecheck + full test suite**

```bash
pnpm typecheck && pnpm test
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/environments/environment.service.ts src/modules/environments/environment.routes.ts
git commit -m "feat: invalidate cache prefix after environment deletion"
```

---

## Task 8: Integration tests for cache invalidation and TTL

**Files:**

- Create: `tests/integration/cache.test.ts`

These tests verify the end-to-end behavior: that a stale cached value is replaced after a mutation, and that TTL expiry causes a fresh DB read. They use the same `buildServer` + `createRootKey` helpers as existing integration tests.

Because each test creates a fresh `buildServer` instance with its own cache, there is no cross-test contamination.

- [ ] **Step 1: Create tests/integration/cache.test.ts**

Follow the same pattern as `tests/integration/flags.test.ts`: one shared `db` per file, `truncateAll` in `beforeEach`, each test creates + closes its own `buildServer` instance, no `afterAll` pool teardown.

```typescript
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { createCache } from '../../src/cache/index.js'
import { flagEnvironments, featureFlags } from '../../src/db/schema.js'
import { buildServer } from '../../src/server.js'
import { getTestDb, truncateAll } from '../helpers/db.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('cache', () => {
  const db = getTestDb()

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db)
  })

  async function setup(app: Awaited<ReturnType<typeof buildServer>>) {
    const rootKey = await createRootKey(db)
    const project = await createProject(app, rootKey)
    const adminKey = await createAdminKey(app, rootKey, project.id)

    const envsRes = await app.inject({
      method: 'GET',
      url: `/api/admin/projects/${project.id}/environments`,
      headers: { authorization: adminKey },
    })
    const envs = envsRes.json<Array<{ id: string; slug: string }>>()
    const prodEnv = envs.find((e) => e.slug === 'production')!
    const clientKey = await createClientKey(app, adminKey, project.id, prodEnv.id)

    return { rootKey, project, adminKey, prodEnv, clientKey }
  }

  describe('flag mutation invalidates cache', () => {
    it('returns fresh state immediately after setFlagEnabled', async () => {
      const app = await buildServer({ db })

      const { project, adminKey, clientKey } = await setup(app)

      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { key: 'my-feature', name: 'My Feature' },
      })

      // First eval -- populates cache with flag disabled
      const first = await app.inject({
        method: 'GET',
        url: '/api/client/features/my-feature',
        headers: { authorization: clientKey },
      })
      expect(first.json<{ enabled: boolean }>().enabled).toBe(false)

      // Enable the flag -- must invalidate cache
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags/my-feature/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      // Immediate second eval -- must see fresh data (not the cached disabled state)
      const second = await app.inject({
        method: 'GET',
        url: '/api/client/features/my-feature',
        headers: { authorization: clientKey },
      })
      expect(second.json<{ enabled: boolean }>().enabled).toBe(true)

      await app.close()
    })

    it('returns fresh state immediately after override is created', async () => {
      const app = await buildServer({ db })

      const { project, adminKey, clientKey } = await setup(app)

      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { key: 'beta', name: 'Beta' },
      })

      // First eval as alice -- disabled, populates cache
      const first = await app.inject({
        method: 'GET',
        url: '/api/client/features/beta?userId=alice',
        headers: { authorization: clientKey },
      })
      expect(first.json<{ enabled: boolean }>().enabled).toBe(false)

      // Add override enabling flag for alice -- must invalidate cache
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags/beta/environments/production/overrides`,
        headers: { authorization: adminKey },
        payload: { contextKey: 'userId', contextValue: 'alice', enabled: true },
      })

      // Immediate eval as alice -- must see the override (not cached disabled state)
      const second = await app.inject({
        method: 'GET',
        url: '/api/client/features/beta?userId=alice',
        headers: { authorization: clientKey },
      })
      expect(second.json<{ enabled: boolean }>().enabled).toBe(true)

      await app.close()
    })
  })

  describe('TTL expiry', () => {
    it('serves stale data within TTL then re-fetches after expiry', async () => {
      // 1-second TTL cache injected so this test does not take 30s
      const shortCache = createCache(1)
      const app = await buildServer({ db, cache: shortCache })

      const { project, adminKey, prodEnv, clientKey } = await setup(app)

      // Create flag and enable it via admin route (this also invalidates the cache)
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags`,
        headers: { authorization: adminKey },
        payload: { key: 'ttl-flag', name: 'TTL Flag' },
      })
      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/flags/ttl-flag/environments/production/enable`,
        headers: { authorization: adminKey },
      })

      // First eval -- populates cache with enabled=true
      const first = await app.inject({
        method: 'GET',
        url: '/api/client/features/ttl-flag',
        headers: { authorization: clientKey },
      })
      expect(first.json<{ enabled: boolean }>().enabled).toBe(true)

      // Directly write enabled=false to DB, bypassing the admin route so no cache invalidation occurs
      const [flag] = await db
        .select()
        .from(featureFlags)
        .where(and(eq(featureFlags.projectId, project.id), eq(featureFlags.key, 'ttl-flag')))
        .limit(1)
      await db
        .update(flagEnvironments)
        .set({ enabled: false })
        .where(
          and(
            eq(flagEnvironments.flagId, flag!.id),
            eq(flagEnvironments.environmentId, prodEnv.id),
          ),
        )

      // Immediate eval -- cache still has enabled=true (stale data served)
      const stale = await app.inject({
        method: 'GET',
        url: '/api/client/features/ttl-flag',
        headers: { authorization: clientKey },
      })
      expect(stale.json<{ enabled: boolean }>().enabled).toBe(true)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Eval after expiry -- must re-fetch from DB and return the updated value
      const fresh = await app.inject({
        method: 'GET',
        url: '/api/client/features/ttl-flag',
        headers: { authorization: clientKey },
      })
      expect(fresh.json<{ enabled: boolean }>().enabled).toBe(false)

      await app.close()
    })
  })
})
```

- [ ] **Step 2: Run the new integration tests**

```bash
pnpm test tests/integration/cache.test.ts
```

Expected: PASS (TTL test takes ~1.1s)

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/cache.test.ts
git commit -m "test: add cache invalidation and TTL integration tests"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run typecheck, lint, and full test suite in sequence**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all PASS with no warnings

- [ ] **Step 2: Mark Phase 2 tasks complete in ROADMAP.md**

Update `docs/ROADMAP.md` -- change all `- [ ]` under Phase 2 to `- [x]`.

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 2 caching tasks complete in roadmap"
```

---

## Appendix: Key decisions

**Why optional `cache` parameter appended to existing signatures?**
Zero breaking changes to existing tests and call sites. Services remain usable without a cache (for tests, CLI tools, or future contexts where caching is not appropriate).

**Why key tracking set for deleteByPrefix?**
BentoCache's memory driver does not expose a native prefix-scan API. A lightweight `Set<string>` of known keys costs almost nothing and makes prefix invalidation exact and correct.

**Why `clear()` was not used for project-wide invalidation?**
`clear()` would flush all projects' caches when one project changes. The prefix approach is surgical: only the affected project's entries are evicted.

**Why is patchFlag not invalidated?**
`patchFlag` only mutates `name` and `description` columns on `featureFlags`. Neither field is part of the evaluation state loaded by `loadFlagState` (which reads only `key` and `enabled`). No evaluation result can change from a `patchFlag` call.

**Why does the TTL test write to the DB directly?**
The TTL test needs to place stale data in the cache without triggering invalidation. Using the admin API would call `setFlagEnabled`, which invalidates the cache -- making the test verify invalidation rather than TTL. Writing via Drizzle directly bypasses the service layer entirely, so the cache entry remains stale until it expires naturally.
