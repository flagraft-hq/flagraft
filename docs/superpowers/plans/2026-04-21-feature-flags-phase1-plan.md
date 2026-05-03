# Feature Flags Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-hosted feature flags service described in `docs/superpowers/specs/2026-04-17-feature-flags-phase1-design.md` from scratch — a Node 20 + Fastify + Drizzle + Postgres monolith providing admin CRUD for projects/flags/overrides and a client evaluation API.

**Architecture:** Three-layer monolith. Fastify routes with Zod validation call service-layer functions which issue Drizzle queries; evaluation is a pure, dependency-free function consumed by the client service. Auth is a Fastify preHandler that SHA-256s an `Authorization` header and attaches a `keyContext` to the request.

**Tech Stack:** Node 20, TypeScript (strict, ES2022, bundler resolution), Fastify 4, Zod, `fastify-type-provider-zod` (Zod → Fastify validator bridge), Drizzle ORM, `drizzle-kit`, `pg`, Vitest, tsup, tsx, pino, dotenv, Postgres 15 via `docker-compose`.

**Repo state:** Empty (`.claude/`, `docs/` only). No git. User handles git commits themselves — **do not run `git add`, `git commit`, or `git push` at any point**. "Checkpoint" means stop, report, and let the user decide.

**Spec reference:** All section references (§N) are to `docs/superpowers/specs/2026-04-17-feature-flags-phase1-design.md` unless otherwise noted. When this plan is terse, the spec is authoritative.

---

## File structure

Matches spec §1.1 exactly. Key files and their responsibilities:

| File                              | Responsibility                                                         |
| --------------------------------- | ---------------------------------------------------------------------- |
| `package.json`                    | scripts, dependencies                                                  |
| `tsconfig.json`                   | strict TS, ES2022, bundler resolution                                  |
| `tsup.config.ts`                  | dual CJS+ESM bundle, two entries                                       |
| `drizzle.config.ts`               | drizzle-kit config for migrations                                      |
| `vitest.config.ts`                | test runner config; serial execution for integration                   |
| `docker-compose.yml`              | Postgres 15 for local/test                                             |
| `.env.example`                    | all env vars from spec §6.1                                            |
| `src/config.ts`                   | Zod-validated frozen config object                                     |
| `src/db/schema.ts`                | Drizzle table definitions (6 tables)                                   |
| `src/db/index.ts`                 | Drizzle client factory                                                 |
| `src/db/migrations/`              | drizzle-kit generated SQL                                              |
| `src/evaluation/engine.ts`        | pure function, zero runtime imports                                    |
| `src/plugins/db.ts`               | decorates fastify with `db`                                            |
| `src/plugins/errorHandler.ts`     | normalized error envelope                                              |
| `src/plugins/auth.ts`             | preHandler + `requireAdminKey` / `requireClientKey` decorators         |
| `src/modules/projects/*`          | project routes/service/schema                                          |
| `src/modules/environments/*`      | environment routes/service/schema                                      |
| `src/modules/flags/*`             | flag routes/service/schema (incl. overrides, enable/disable, api keys) |
| `src/modules/client/*`            | client evaluation routes/service                                       |
| `src/server.ts`                   | `buildServer(opts?)` + `start()`                                       |
| `src/cli/create-root-key.ts`      | bootstrap root admin key CLI                                           |
| `tests/evaluation/engine.test.ts` | 9 unit tests for the engine                                            |
| `tests/integration/*.test.ts`     | 5 integration scenarios from spec §7.3                                 |
| `tests/helpers/db.ts`             | test db factory + truncation helper                                    |
| `README.md`                       | quickstart per spec §6.6                                               |

**Note on API keys (deviation from spec §1.1):** The spec's file layout only enumerates `projects/environments/flags/client` modules but §5.2 introduces an API keys resource. This plan adds a dedicated `src/modules/keys/{key.routes.ts, key.service.ts, key.schema.ts}` module to keep responsibilities clean rather than folding keys into the projects module. Routes still live under `/api/admin/projects/:projectId/keys` per spec §5.2 — only the file layout differs.

---

## Task 1: Scaffold project (package.json, tsconfig, tooling configs)

**Files:**

- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `docker-compose.yml`, `drizzle.config.ts`

- [ ] **Step 1: Create `package.json`** with scripts from spec §6.5 and dependencies: `fastify@^4`, `zod`, `fastify-type-provider-zod`, `drizzle-orm`, `drizzle-kit`, `pg`, `dotenv`, `pino`; devDeps: `typescript`, `@types/node`, `@types/pg`, `tsup`, `tsx`, `vitest`. `"type": "module"`. Node engine `">=20"`.

- [ ] **Step 2: Create `tsconfig.json`** with `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `esModuleInterop: true`, `skipLibCheck: true`, `resolveJsonModule: true`, `outDir: "dist"`, `rootDir: ".", includes: ["src/**/*", "tests/**/*"]`.

- [ ] **Step 3: Create `tsup.config.ts`** per spec §6.4: entries `['src/server.ts', 'src/cli/create-root-key.ts']`, `format: ['cjs', 'esm']`, `dts: true`, `clean: true`, `sourcemap: true`.

- [ ] **Step 4: Create `vitest.config.ts`** — `test.environment: 'node'`, `test.include: ['tests/**/*.test.ts']`, `test.poolOptions.threads.singleThread: true` (integration tests share a DB — avoid races).

- [ ] **Step 5: Create `.env.example`** with `DATABASE_URL=postgres://flagraft:flagraft@localhost:5432/flagraft`, `PORT=3000`, `NODE_ENV=development`, `LOG_LEVEL=info`, and a commented `# TEST_DATABASE_URL=postgres://flagraft:flagraft@localhost:5432/flagraft_test` (consumed by tests only, not app config). Add comment pointing to `pnpm admin:create-root-key`.

- [ ] **Step 6: Create `.gitignore`** — `node_modules`, `dist`, `.env`, `coverage`, `*.log`.

- [ ] **Step 7: Create `docker-compose.yml`** — single Postgres 15 service `flagraft-pg`, expose 5432, volume for data, create two DBs via init script (or document creating `flagraft_test` manually in README).

- [ ] **Step 8: Create `drizzle.config.ts`** — `schema: './src/db/schema.ts'`, `out: './src/db/migrations'`, `dialect: 'postgresql'`, `dbCredentials: { url: process.env.DATABASE_URL! }`.

- [ ] **Step 9: Verify install** — Run `pnpm install`. Expected: clean install, no peer warnings blocking. If pnpm is missing, stop and ask the user.

- [ ] **Step 10: Checkpoint** — Report to user. Let them commit.

---

## Task 2: Config module (TDD)

**Files:**

- Create: `src/config.ts`, `tests/config.test.ts`

- [ ] **Step 1: Write failing test** — `tests/config.test.ts`: import `loadConfig` from `../src/config`, pass a fake `env` object missing `DATABASE_URL`, assert it throws. Pass a valid env object, assert frozen output matches.

- [ ] **Step 2: Run** — `pnpm test tests/config.test.ts`. Expected: fails (module not found).

- [ ] **Step 3: Implement `src/config.ts`** — export `loadConfig(env = process.env)` that Zod-validates `{ DATABASE_URL: z.string().url(), PORT: z.coerce.number().default(3000), NODE_ENV: z.enum(['development','production','test']).default('development'), LOG_LEVEL: z.string().default('info') }`, throws on failure with a readable message, returns `Object.freeze(...)`. Do not export a module-level `config` singleton — callers invoke `loadConfig()` explicitly so tests stay deterministic. `TEST_DATABASE_URL` is NOT part of this schema; tests read it directly from `process.env` in `tests/helpers/db.ts` (per spec §7.2).

- [ ] **Step 4: Run test** — Expected: PASS.

- [ ] **Step 5: Checkpoint.**

---

## Task 3: Evaluation engine (TDD, pure)

The engine is the hot path and must stay pure. Spec §4 has the full implementation and all 9 test cases — copy them verbatim.

**Files:**

- Create: `src/evaluation/engine.ts`, `tests/evaluation/engine.test.ts`

- [ ] **Step 1: Write the 9 tests** from spec §4.2 in `tests/evaluation/engine.test.ts`. Include the static-analysis test as case 9: read the engine file as a string, parse import lines, assert every `import` is prefixed with `type` (e.g. regex `/^import\s+type\b/` on each non-empty import line; trivial implementation OK — this is a safety net, not a parser).

- [ ] **Step 2: Run** — `pnpm test tests/evaluation/engine.test.ts`. Expected: all 9 fail.

- [ ] **Step 3: Implement `src/evaluation/engine.ts`** — copy verbatim from spec §4. All named types + `evaluateFlag` function. Only `import type` allowed.

- [ ] **Step 4: Run tests** — Expected: 9/9 PASS.

- [ ] **Step 5: Checkpoint.**

---

## Task 4: DB schema + migration

**Files:**

- Create: `src/db/schema.ts`, `src/db/index.ts`, `src/db/migrations/` (generated)

- [ ] **Step 1: Implement `src/db/schema.ts`** — Drizzle `pgTable` definitions for the 6 tables per spec §2. Enumerated requirements the executor must get right:
  - Every table: `id uuid PK default gen_random_uuid()`, `created_at timestamptz default now()`. `updated_at` where spec lists it.
  - All FKs: `onDelete: 'cascade'`.
  - Composite uniques: `environments(project_id, slug)`; `feature_flags(project_id, key)`; `flag_environments(flag_id, environment_id)`; `flag_overrides(flag_id, environment_id, context_key, context_value)`.
  - `api_keys.key_hash` UNIQUE (single-column).
  - `api_keys.type` CHECK in (`'client'`, `'admin'`) — expressed via Drizzle's `check()` constraint or as an enum column (prefer text + check).
  - `api_keys.project_id` and `api_keys.environment_id` are NULLABLE (root admin).
  - Export tables + `$inferSelect` / `$inferInsert` types per table.

- [ ] **Step 2: Implement `src/db/index.ts`** — export `createDb(connectionString: string)` that builds a `node-postgres` pool and returns `drizzle(pool, { schema })`. Also export `Db` type (`ReturnType<typeof createDb>`).

- [ ] **Step 3: Generate migration** — Run `pnpm db:generate`. Expected: a new SQL file appears in `src/db/migrations/`. Inspect it; sanity-check cascades and uniques are present.

- [ ] **Step 4: Apply migration to local DB** — Start `docker compose up -d`, run `pnpm db:migrate`. Expected: tables exist. Verify with `psql -c '\dt'` listing 6 tables plus drizzle's migrations table.

- [ ] **Step 5: Checkpoint.**

---

## Task 5: Test helpers + integration scaffolding

**Files:**

- Create: `tests/helpers/db.ts`, `tests/helpers/fixtures.ts`

- [ ] **Step 1: `tests/helpers/db.ts`** — export `getTestDb()` which reads `TEST_DATABASE_URL`, builds a Drizzle client, and exposes `truncateAll()` that runs `TRUNCATE api_keys, flag_overrides, flag_environments, feature_flags, environments, projects RESTART IDENTITY CASCADE` in one statement. README must document running `pnpm db:migrate` against the test DB once before tests.

- [ ] **Step 2: `tests/helpers/fixtures.ts`** — stubs (empty functions) for `createRootKey`, `createProject`, `createAdminKey`, `createClientKey`. Will be filled in later tasks as endpoints exist; keep as `throw new Error('not yet implemented')` with TODO comments tied to the task that fills them.

- [ ] **Step 3: Checkpoint.**

---

## Task 6: Error handler plugin (TDD)

**Files:**

- Create: `src/plugins/errorHandler.ts`, `tests/plugins/errorHandler.test.ts`

- [ ] **Step 1: Write `tests/plugins/errorHandler.test.ts`** — build a minimal Fastify instance, register the plugin, add throwaway routes that throw each error type. Use `fastify.inject()` to assert each branch:
  - Route throws `ZodError` → response 400, body `{ error: 'ValidationError', statusCode: 400, issues: [...] }`.
  - Route throws a Postgres-shaped error `{ code: '23505' }` → 409 `{ error: 'Conflict', statusCode: 409 }`.
  - Route throws `new AppError('not found', 404, 'NotFound')` → 404 with matching code/message.
  - Route throws `new Error('boom')` → 500 `{ error: 'InternalServerError', message: 'Internal error', statusCode: 500 }` — body does NOT contain `'boom'` or stack.

- [ ] **Step 2: Run — expect failures (module missing).**

- [ ] **Step 3: Implement `src/plugins/errorHandler.ts`** — a `fastify-plugin` registering `setErrorHandler` with the four branches above. Export `AppError` class (`extends Error`, takes `message, statusCode, code`).

- [ ] **Step 4: Run tests — PASS.**

- [ ] **Step 5: Checkpoint.**

---

## Task 7: DB plugin

**Files:**

- Create: `src/plugins/db.ts`

- [ ] **Step 1: Implement `src/plugins/db.ts`** — A `fastify-plugin` that accepts `{ db?: Db, connectionString?: string }`. If `db` provided, decorate as-is (tests pass this). Otherwise build one from `connectionString` (or config). Decorate `fastify.db`. Register `onClose` to end the pool (only if plugin created it).

- [ ] **Step 2: Checkpoint.**

---

## Task 8: Auth plugin + CLI bootstrap

**Files:**

- Create: `src/plugins/auth.ts`, `src/cli/create-root-key.ts`

- [ ] **Step 1: Write `src/plugins/auth.ts`** per spec §3.4:
  - Export helper `hashKey(plaintext: string): string` = `sha256 hex`.
  - Export helper `generateKey(): { plaintext: string, prefix: string, hash: string }` — `ff_` + 32 hex via `crypto.randomBytes(16).toString('hex')`; prefix = first 12 chars.
  - Register `preHandler` that reads `Authorization`, hashes, looks up `api_keys`. Attach `request.keyContext = { keyId, projectId, environmentId, type, isRoot }`. Fire-and-forget `last_used_at` update (don't `await`; log rejected promise).
  - Export `requireAdminKey` and `requireClientKey` as route-level `preHandler` functions. `requireAdminKey`: `type === 'admin'`; if route has `params.projectId`, assert match or isRoot else 403. Root-only wrapper `requireRootKey` for project create/delete.
  - Extend Fastify `FastifyRequest` module declaration with `keyContext?`.

- [ ] **Step 2: Write `src/cli/create-root-key.ts`** — standalone script. Load config, build DB client, generate a key, insert into `api_keys` with `project_id=NULL, environment_id=NULL, type='admin'`. Print the plaintext once with the banner from spec §3.5. Fail fast with a helpful message if `DATABASE_URL` is missing or the `api_keys` table doesn't exist.

- [ ] **Step 3: Checkpoint.** Auth gets exercised by Task 14 integration tests; no unit tests for the plugin itself (would just duplicate the integration coverage).

---

## Task 9: Server bootstrap

**Files:**

- Create: `src/server.ts`

- [ ] **Step 1: Implement `buildServer(opts?: { db?: Db })`** — create Fastify instance with `logger: { level: config.LOG_LEVEL }`, register plugins in order: `db` (pass `opts.db` through) → `errorHandler` → `auth` → route modules (stubbed for now; add imports as modules land). Return the instance without listening.

- [ ] **Step 2: Implement `start()`** — `buildServer()` then `listen({ port: config.PORT, host: '0.0.0.0' })`. Gate with `if (import.meta.url === pathToFileURL(process.argv[1]).href)` so tests can import without side effects.

- [ ] **Step 3: Smoke test** — `pnpm dev`; hit `/` expect 404 (no routes yet). Stop server. Checkpoint.

---

## Task 10: Projects module (TDD via integration test)

**Files:**

- Create: `src/modules/projects/{project.routes.ts, project.service.ts, project.schema.ts}`
- Modify: `src/server.ts` to register project routes
- Update: `tests/helpers/fixtures.ts` — implement `createRootKey` (direct DB insert using auth helpers) and `createProject(rootKey)` (via `fastify.inject`)

- [ ] **Step 1: Write `tests/integration/projects.test.ts`** — happy path + auth scope cases:
  - root creates project → 201 + auto-creates `development/staging/production` envs.
  - project-admin cannot create a project → 403.
  - root can list/get/patch/delete.
  - duplicate slug → 409.
  - cascade: delete project removes envs (verify via direct DB query).

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Implement `project.schema.ts`** — Zod schemas for create (name, slug, description?), patch, and response shapes. Export inferred types.

- [ ] **Step 4: Implement `project.service.ts`** — `createProject(db, input)` runs in a transaction: insert project, then bulk-insert the three default environments. `listProjects(db, keyContext)` — if root, all; else only `WHERE id = keyContext.projectId`. Get/patch/delete helpers.

- [ ] **Step 5: Implement `project.routes.ts`** — Fastify plugin registering all routes from spec §5.2 Projects, using `requireAdminKey` and `requireRootKey` as appropriate. Wire Zod schemas.

- [ ] **Step 6: Register routes in `server.ts`.** Re-run tests. Expected: PASS.

- [ ] **Step 7: Checkpoint.**

---

## Task 11: Environments module

**Files:**

- Create: `src/modules/environments/{environment.routes.ts, environment.service.ts, environment.schema.ts}`
- Modify: `src/server.ts`

- [ ] **Step 1: Write `tests/integration/environments.test.ts`** — POST creates env (unique per `(project, slug)`, 409 on dup); GET list; DELETE cascades to `flag_environments` (verify).

- [ ] **Step 2: Run — fail. Implement module (routes/service/schema).** Re-run → PASS.

- [ ] **Step 3: Checkpoint.**

---

## Task 12: Flags module (including enable/disable, overrides)

Flags is the biggest module. Split internally but keep in one directory for co-location.

**Files:**

- Create: `src/modules/flags/{flag.routes.ts, flag.service.ts, flag.schema.ts, override.routes.ts, override.service.ts, override.schema.ts}`
- Modify: `src/server.ts`

- [ ] **Step 1: Write `tests/integration/flags.test.ts`** — create flag auto-creates `flag_environments` rows for every env in the project; enable in `staging` flips the row; disable reverts; PATCH updates metadata; DELETE cascades to `flag_environments` + `flag_overrides`; duplicate flag key per project → 409.

- [ ] **Step 2: Write `tests/integration/overrides.test.ts`** — add override `userId=user_abc123 → true` on an off flag; GET list; DELETE; duplicate `(flag, env, key, value)` → 409. (Evaluation via the client endpoint happens in Task 14.)

- [ ] **Step 3: Implement schemas, services, routes.** Transaction for create-flag (insert flag + bulk insert `flag_environments` one row per env). Enable/disable routes UPSERT `flag_environments` (idempotent per spec §5.3) with `ON CONFLICT (flag_id, environment_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`. Override routes support POST/GET/DELETE.

- [ ] **Step 4: Run tests → PASS. Checkpoint.**

---

## Task 13: API keys module

**Files:**

- Create: `src/modules/keys/{key.routes.ts, key.service.ts, key.schema.ts}`
- Modify: `src/server.ts`, `tests/helpers/fixtures.ts` (now implement `createAdminKey`, `createClientKey` via endpoints).

- [ ] **Step 1: Write `tests/integration/keys.test.ts`** — POST returns plaintext key exactly once, response contains `{ id, key, prefix, type, environmentId, createdAt }`; GET never returns `key` or `keyHash`; DELETE revokes; service-layer rule violations (e.g. `type='client'` with no `environmentId`) → 400.

- [ ] **Step 2: Implement.** Service enforces rules from spec §2.1: `type='client'` requires both project and environment; `type='admin'` must have `environmentId=NULL`; root creation is CLI-only (API always sets `project_id` from URL).

- [ ] **Step 3: Tests → PASS. Checkpoint.**

---

## Task 14: Client evaluation routes + full integration scenarios

**Files:**

- Create: `src/modules/client/{client.routes.ts, client.service.ts}`
- Modify: `src/server.ts`
- Create: `tests/integration/auth-scopes.test.ts`, `tests/integration/conflicts.test.ts`, `tests/integration/cascades.test.ts` (the five required scenarios from spec §7.3 — any previously covered within Tasks 10–13 can be referenced rather than duplicated).

- [ ] **Step 1: Implement `client.service.ts`** — `loadFlagState(db, projectId, environmentId)`: single or two queries fetching `flag_environments` + matching `flag_overrides` ordered by `created_at ASC`, grouped by flag key into `FlagEnvironmentState` keyed by flag name. `evaluateAll(state, ctx)` maps each entry through `evaluateFlag`.

- [ ] **Step 2: Implement `client.routes.ts`** — `GET /api/client/features` reads all query params as context (everything is a string per `EvaluationContext`), returns `{ features: [{ name, enabled }] }`. `GET /api/client/features/:flagKey` — same context path, returns `{ name, enabled, reason }`, 404 if unknown. Both use `requireClientKey`; read `projectId`/`environmentId` from `keyContext` only.

- [ ] **Step 3: Write full scenarios from spec §7.3 (5 tests).** The happy-path and override-flow scenarios exercise the client endpoint end-to-end.

- [ ] **Step 4: Run all tests** — `pnpm test`. Expected: full green.

- [ ] **Step 5: Checkpoint.**

---

## Task 15: Docs + final verification

**Files:**

- Create: `README.md`

- [ ] **Step 1: Write README.md** per spec §6.6 — prerequisites, `pnpm install`, `.env`, `docker compose up -d`, `pnpm db:migrate` for both DBs, `pnpm admin:create-root-key`, `pnpm dev`, `pnpm test`. Include a troubleshooting note: "if `pnpm admin:create-root-key` fails with `relation "api_keys" does not exist`, run `pnpm db:migrate` first."

- [ ] **Step 2: Final verification pass:**
  - `pnpm typecheck` → clean.
  - `pnpm build` → tsup produces `dist/server.{cjs,js}` + `dist/create-root-key.{cjs,js}` + `.d.ts` files.
  - `pnpm test` → all green.
  - Smoke test manually: `pnpm admin:create-root-key` → copy plaintext → `curl -H "Authorization: <key>" http://localhost:3000/api/admin/projects` returns `[]`. POST a project, GET it back.

- [ ] **Step 3: Checkpoint — hand back to user.**

---

## Notes for the executor

- **No git.** User handles all commits. "Checkpoint" = stop and report; do not `git add`/`commit`/`push`.
- **Test DB.** Integration tests require `TEST_DATABASE_URL` pointing at a migrated Postgres. `docker-compose.yml` provides one; README documents how to create `flagraft_test` and migrate it.
- **Serial tests.** Vitest is configured `singleThread: true` to avoid DB state races. If tests later need isolation, use a transaction-per-test pattern instead of TRUNCATE — but not in Phase 1.
- **Spec is authoritative.** When this plan is terse, read the spec section referenced.
- **No BentoCache.** Deferred to Phase 3; keep service boundaries so caching can wrap `loadFlagState` later without touching the engine.
