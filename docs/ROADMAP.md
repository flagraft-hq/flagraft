# Flagraft Roadmap

**Period:** May 2026 - June 2026
**Status:** Living document -- updated as priorities shift

---

## Current State (as of April 2026)

Phase 1 is complete. The core service is working:

- Admin CRUD for projects, environments, flags, overrides, and API keys
- Client evaluation API with context-aware override resolution
- Three-tier auth (root admin / project admin / client)
- Pure evaluation engine with zero runtime dependencies
- Integration and unit test coverage
- ESLint v9 + Prettier configured

---

## Phase 2 -- Caching Layer (Weeks 1-2, May 5-16)

**Goal:** Make the client evaluation hot path production-safe under real traffic. Every flag evaluation today issues two DB queries. BentoCache wraps only the data-loading layer -- the engine and routes stay untouched.

**Why now:** The evaluation engine was intentionally kept pure so caching could be added in isolation. This is the highest-leverage performance change before exposing the service to real load.

### Tasks

**Setup**

- [x] Add `bentocache` and `@bentocache/drivers/memory` as dependencies
- [x] Add `CACHE_TTL_SECONDS` to `src/config.ts` with Zod validation (default `30`, coerced number)
- [x] Add `CACHE_TTL_SECONDS` to `.env.example` with a comment explaining its effect

**Integration**

- [x] Create `src/cache/index.ts` -- exports a `createCache(ttl: number)` factory using BentoCache memory driver
- [x] Register cache as a Fastify plugin (`src/plugins/cache.ts`) and decorate `fastify.cache`
- [x] Wrap `clientService.loadFlagStates()` to check cache before issuing DB queries
- [x] Cache key format: `flags:${projectId}:${environmentId}`

**Invalidation**

- [x] Call `fastify.cache.delete(key)` in flag service after any create / update / delete
- [x] Call `fastify.cache.delete(key)` in override service after any create / delete
- [x] Call `fastify.cache.deleteByPrefix('flags:${projectId}')` when an environment is deleted

**Tests**

- [x] Unit test: cache hit does not call the DB query function
- [x] Unit test: cache miss calls through and stores result
- [x] Integration test: flag update invalidates cache so next eval reads fresh data
- [x] Integration test: verify TTL expiry causes a fresh DB read (use fake timers)

---

## Phase 3 -- CI/CD and Production Hardening (Weeks 3-4, May 19-30)

**Goal:** The service should be deployable, observable, and defensible before it sees production traffic or external contributors.

### Tasks

**GitHub Actions CI**

- [x] Create `.github/workflows/ci.yml`
- [x] Jobs: `lint` (`pnpm lint`), `typecheck` (`pnpm typecheck`), `test` (`pnpm test`)
- [x] Spin up a Postgres 15 service container for the test job
- [x] Run `pnpm db:migrate` against the test DB before running tests
- [x] Cache `node_modules` using pnpm store path for faster runs
- [x] Fail the pipeline if any job exits non-zero

**Docker**

- [x] Write a multi-stage `Dockerfile`:
  - Build stage: `node:20-alpine`, install deps, run `pnpm build`
  - Runtime stage: `node:20-alpine`, copy `dist/`, run `node dist/server.cjs`
- [x] Add `.dockerignore` (exclude `node_modules`, `dist`, `.env`, `tests`, `docs`)
- [x] Add `docker build` smoke test to CI

**Health and Observability**

- [x] Add `GET /health` route -- no auth, returns `{ status: 'ok', uptime: process.uptime() }`
- [x] Add `GET /ready` route -- checks DB connectivity with a `SELECT 1`, returns 200 or 503
- [x] Add request-level logging via pino's built-in Fastify integration (log method, url, statusCode, responseTime)
- [x] Add `X-Request-Id` header to all responses using `@fastify/request-context` or `fastify.genReqId`

**Graceful Shutdown**

- [x] Handle `SIGTERM` and `SIGINT` in `src/server.ts`
- [x] Call `fastify.close()` on signal to drain in-flight requests
- [x] End DB pool after server closes

**Rate Limiting**

- [x] Add `@fastify/rate-limit` as a dependency
- [x] Apply rate limiting to `/api/client/*` routes only (eval hot path)
- [x] Configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` env vars
- [x] Return 429 with the standard error envelope shape on breach

**OpenAPI Documentation**

- [x] Add `@fastify/swagger` and `@fastify/swagger-ui` as dependencies
- [x] Serve OpenAPI JSON at `/docs/json`
- [x] Serve Swagger UI at `/docs`
- [x] Annotate all route schemas with `description` and `tags` fields
- [x] Disable docs route in production via `NODE_ENV` check

---

## Phase 4 -- TypeScript SDK (Weeks 5-6, June 2-13)

**Goal:** Give consumers a first-party SDK so they do not have to hand-roll HTTP calls and local caching. This also validates that the API contract is ergonomic.

### Tasks

**Workspace Setup**

- [x] Convert the repo to a pnpm workspace (`pnpm-workspace.yaml`)
- [x] Create `packages/sdk-js/` with its own `package.json` (name: `@flagraft/sdk`)
- [x] Configure `tsup` in `packages/sdk-js/` for dual CJS + ESM output with declaration files
- [x] Add `packages/sdk-js` to the root CI workflow

**Client Core**

- [x] Implement `FlagraftClient` class in `packages/sdk-js/src/client.ts`
  - Constructor accepts `{ baseUrl: string, apiKey: string, ttl?: number }`
  - `isEnabled(flagKey: string, context?: Record<string, string>): Promise<boolean>`
  - `getFeatures(context?: Record<string, string>): Promise<Record<string, boolean>>`
  - `getAllFeatures(context?: Record<string, string>): Promise<Array<{ name: string, enabled: boolean }>>`
- [x] Typed `EvaluationContext` re-exported from the SDK for consumer use

**Local Cache**

- [x] Implement a simple TTL map cache in `packages/sdk-js/src/cache.ts`
- [x] Cache key: `${flagKey}:${JSON.stringify(sortedContext)}`
- [x] Default TTL: 30 seconds, configurable at construction
- [x] `getFeatures` caches the full response keyed by context
- [x] Cache bypassed when TTL is set to 0

**Error Handling**

- [x] Network failures return `false` (never throw) -- safe default for flag checks
- [x] Log warning to `console.warn` on network failure so developers notice during development
- [x] 4xx responses from the server surface as typed `FlagraftError` (not swallowed)

**Tests**

- [x] Set up `msw` for mocking the Flagraft server in SDK tests
- [x] Test: `isEnabled` returns `true` / `false` correctly from server response
- [x] Test: second call within TTL returns cached value without hitting the network
- [x] Test: cache miss after TTL expiry issues a new network request
- [x] Test: network failure returns `false` without throwing
- [x] Test: `getFeatures` maps the response to a plain object

**Documentation**

- [x] Write `packages/sdk-js/README.md` with install, quickstart, and API reference
- [x] Add SDK usage to the root `README.md` under a "Client SDKs" section

---

## Phase 5 -- Admin UI (Weeks 7-8, June 16-27)

**Goal:** A minimal web UI for flag management so non-technical team members can toggle flags and view overrides without hitting the API directly.

### Tasks

**Stack Decision**

- [ ] Choose framework: React + Vite (recommended -- matches most team familiarity and has the widest component ecosystem for dashboards)
- [ ] Create `packages/admin-ui/` in the pnpm workspace
- [ ] Set up Vite + React + TypeScript + Tailwind CSS

**Core Pages**

- [ ] Login page -- accepts a root or project admin API key, stores in `sessionStorage`
- [ ] Projects list -- shows all projects the key has access to
- [ ] Project detail -- lists environments and flags
- [ ] Flag detail -- shows flag status per environment, with toggle button, and lists overrides

**Components**

- [ ] `FlagToggle` -- toggle switch that calls enable/disable API, optimistic UI update
- [ ] `OverrideList` -- table of overrides for a flag in an environment
- [ ] `CreateOverrideModal` -- form to add a new override (contextKey, contextValue, enabled)
- [ ] `DeleteConfirmDialog` -- reusable confirmation modal for destructive actions
- [ ] `ApiKeyManager` -- list and revoke API keys per project

**API Integration**

- [ ] Generate a typed API client from the OpenAPI spec (using `openapi-typescript`)
- [ ] Centralize all API calls in `packages/admin-ui/src/api/`
- [ ] Handle 401 by clearing the session and redirecting to login
- [ ] Handle 409 conflicts with a user-friendly toast notification

**Tests**

- [ ] Component tests using Vitest + Testing Library for `FlagToggle` and `CreateOverrideModal`
- [ ] Integration smoke test: login flow renders the projects list

---

## Backlog (Post June 2026)

These are deliberately deferred. Revisit priority based on actual usage patterns.

| Item                          | Notes                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Percentage rollout strategies | High value for gradual deploys; engine is ready for this extension                |
| User segments                 | Groups of users sharing override rules; reduces override count at scale           |
| SSE / real-time flag push     | Push flag changes to connected SDKs without polling; needs persistent connections |
| Audit log                     | Record who changed what and when; important for compliance-sensitive teams        |
| Impression tracking           | Count how many times each flag was evaluated; requires a separate write pipeline  |
| Multi-tenancy / org layer     | Needed only when serving external customers beyond internal teams                 |
| Python and Go SDKs            | Follow-on from the JS SDK once the API contract is stable                         |

---

## Principles Guiding Prioritization

1. **Hot path first.** Caching (Phase 2) comes before UI (Phase 5) because slow evaluations affect every production request.
2. **Deployability before features.** CI, Docker, and graceful shutdown (Phase 3) must exist before any feature is worth shipping.
3. **SDK before UI.** Engineers integrate SDKs; the UI helps non-engineers. Engineers are the first audience.
4. **Defer rollout strategies.** The override system covers most gradual rollout needs today via targeted user IDs.
