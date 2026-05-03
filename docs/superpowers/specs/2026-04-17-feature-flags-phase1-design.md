# Feature Flags — Phase 1 Design

**Date:** 2026-04-17
**Status:** Approved (brainstorm), pending spec review
**Scope:** Self-hosted feature flag service. Backend + API only. No rollout strategies, no segments, no SSE, no admin UI.

---

## 1. Architecture

Node 20 / Fastify 4 / Drizzle / Postgres monolith, living at the root of the `flagraft` repo.

Three layers:

1. **Routes (Fastify).** HTTP contract, Zod request validation, auth decorators. One module per resource (`projects`, `flags`, `environments`, `client`).
2. **Services.** Drizzle query-builder reads/writes. Transactions for multi-table writes.
3. **Evaluation engine.** Pure function, no imports except types. Given `FlagEnvironmentState + EvaluationContext`, returns `{ enabled, reason }`.

Shared concerns (`auth`, `db`, `errorHandler`) live in `src/plugins/`. The engine lives in `src/evaluation/engine.ts` so Phase 3 can wrap DB loading in BentoCache without touching evaluation logic.

**Client hot path:**
request → auth plugin (SHA-256 lookup on `api_keys`, attaches `keyContext`) → client route handler → service issues two queries (`flag_environments` + `flag_overrides` for `(project, env)`) → map rows into `FlagEnvironmentState[]` → engine evaluates each flag against the context → response shaped as `{ features: [{ name, enabled }] }`.

### 1.1 Project layout

```
flagraft/
├── src/
│   ├── cli/
│   │   └── create-root-key.ts        # bootstrap script
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── migrations/
│   ├── evaluation/
│   │   └── engine.ts                 # pure function, zero runtime imports
│   ├── modules/
│   │   ├── projects/
│   │   │   ├── project.routes.ts
│   │   │   ├── project.service.ts
│   │   │   └── project.schema.ts
│   │   ├── environments/
│   │   │   ├── environment.routes.ts
│   │   │   ├── environment.service.ts
│   │   │   └── environment.schema.ts
│   │   ├── flags/
│   │   │   ├── flag.routes.ts
│   │   │   ├── flag.service.ts
│   │   │   └── flag.schema.ts
│   │   └── client/
│   │       ├── client.routes.ts
│   │       └── client.service.ts
│   ├── plugins/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   └── errorHandler.ts
│   ├── config.ts
│   └── server.ts
├── tests/
│   ├── evaluation/
│   │   └── engine.test.ts
│   ├── integration/
│   │   ├── flags.test.ts
│   │   ├── overrides.test.ts
│   │   ├── auth-scopes.test.ts
│   │   ├── conflicts.test.ts
│   │   └── cascades.test.ts
│   └── helpers/
│       └── db.ts
├── docker-compose.yml                # postgres for tests / local dev
├── drizzle.config.ts
├── tsup.config.ts
├── tsconfig.json
├── .env.example
├── package.json
└── README.md
```

---

## 2. Data model

All tables use `timestamptz DEFAULT now()` for timestamps and `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. All foreign keys cascade on delete.

```sql
-- projects
id          uuid PK
name        text NOT NULL
slug        text UNIQUE NOT NULL
description text
created_at  timestamptz
updated_at  timestamptz

-- environments
id          uuid PK
project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE
name        text NOT NULL
slug        text NOT NULL
created_at  timestamptz
UNIQUE (project_id, slug)

-- feature_flags
id          uuid PK
project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE
name        text NOT NULL
key         text NOT NULL
description text
created_at  timestamptz
updated_at  timestamptz
UNIQUE (project_id, key)

-- flag_environments
id             uuid PK
flag_id        uuid NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE
environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE
enabled        boolean NOT NULL DEFAULT false
updated_at     timestamptz
UNIQUE (flag_id, environment_id)

-- flag_overrides
id             uuid PK
flag_id        uuid NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE
environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE
context_key    text NOT NULL
context_value  text NOT NULL
enabled        boolean NOT NULL
created_at     timestamptz
UNIQUE (flag_id, environment_id, context_key, context_value)

-- api_keys
id             uuid PK
project_id     uuid NULL REFERENCES projects(id) ON DELETE CASCADE  -- NULL = root
environment_id uuid NULL REFERENCES environments(id) ON DELETE CASCADE
key_hash       text UNIQUE NOT NULL      -- sha256(plaintext_key)
key_prefix     text NOT NULL             -- first 12 chars of plaintext, e.g. "ff_abc123def"
type           text NOT NULL CHECK (type IN ('client', 'admin'))
description    text
created_at     timestamptz
last_used_at   timestamptz
```

### 2.1 Notable choices

- **SHA-256, not bcrypt.** API keys are 32 hex chars (128 bits entropy). Bcrypt's salt randomness breaks direct lookup (`WHERE key_hash = bcrypt(incoming)` doesn't work) and would force a full table scan on every request. SHA-256 is the standard choice for high-entropy tokens (GitHub, Stripe, Unleash).
- **Nullable `project_id` on `api_keys`.** Root admin keys have `project_id IS NULL AND environment_id IS NULL AND type = 'admin'`. Enforced in service layer, not by a check constraint (the rules span multiple columns).
- **Service-layer integrity rules** for `api_keys`:
  - `type='client'` ⇒ `project_id` and `environment_id` both non-null.
  - `type='admin'` ⇒ `environment_id IS NULL`.
  - Root admin (`project_id IS NULL`) can only be created by the CLI.

---

## 3. Auth model

### 3.1 Key format & hashing

- Plaintext: `ff_` + 32 hex chars from `crypto.randomBytes(16)`.
- Stored: `sha256(plaintext)` in `key_hash`, `UNIQUE` indexed.
- Display: `key_prefix` = first 12 chars (`ff_` + 9 hex) — enough to eyeball but not reveal.
- Plaintext returned exactly once, at creation. Never retrievable afterwards.

### 3.2 Authorization header

`Authorization: <plaintext_key>` — no `Bearer` prefix. Matches Unleash client conventions and keeps SDK integration trivial.

### 3.3 Three key tiers

| Tier          | `project_id` | `environment_id` | `type`   | Capabilities                                                        |
| ------------- | ------------ | ---------------- | -------- | ------------------------------------------------------------------- |
| Root admin    | NULL         | NULL             | `admin`  | Everything, including create/delete projects. **CLI-created only.** |
| Project admin | set          | NULL             | `admin`  | Full CRUD within that project. Cannot create/delete projects.       |
| Client        | set          | set              | `client` | Read-only evaluation for its `(project, environment)`.              |

### 3.4 Fastify plugin

`src/plugins/auth.ts` registers a `preHandler` that:

1. Reads `Authorization` header. Missing → 401.
2. Computes `sha256(header)`, looks up `api_keys` by `key_hash`. Not found → 401.
3. Attaches `request.keyContext = { keyId, projectId, environmentId, type, isRoot }` (where `isRoot = projectId === null`).
4. Fires a non-awaited `UPDATE api_keys SET last_used_at = now() WHERE id = $1` (fire-and-forget — errors logged but don't block the request).

Decorators wrap the hook with scope checks:

- `fastify.requireAdminKey` — accepts `type='admin'` (root or project-scoped). For routes with `:projectId`, asserts `keyContext.projectId === params.projectId || keyContext.isRoot`, else 403.
- `fastify.requireClientKey` — accepts `type='client'` only. Route handlers read `projectId`/`environmentId` from `keyContext`, never from URL.
- Project create/delete additionally require `keyContext.isRoot === true`.

### 3.5 Bootstrap CLI

`src/cli/create-root-key.ts` — standalone script, not routed through Fastify:

```
$ pnpm admin:create-root-key
Created root admin key. Save this — it will not be shown again:
  ff_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

Inserts directly into `api_keys` with `project_id=NULL, environment_id=NULL, type='admin'`. Fails with a helpful message if `DATABASE_URL` is unset or migrations haven't been applied.

---

## 4. Evaluation engine

Pure function in `src/evaluation/engine.ts`. Exact shape from the original brief:

```ts
export interface EvaluationContext {
  userId?: string
  sessionId?: string
  [key: string]: string | undefined
}

export interface FlagOverride {
  contextKey: string
  contextValue: string
  enabled: boolean
}

export interface FlagEnvironmentState {
  enabled: boolean
  overrides: FlagOverride[]
}

export interface EvaluationResult {
  enabled: boolean
  reason: 'override' | 'default'
}

export function evaluateFlag(
  state: FlagEnvironmentState,
  context: EvaluationContext,
): EvaluationResult {
  for (const override of state.overrides) {
    const ctxValue = context[override.contextKey]
    if (ctxValue !== undefined && ctxValue === override.contextValue) {
      return { enabled: override.enabled, reason: 'override' }
    }
  }
  return { enabled: state.enabled, reason: 'default' }
}
```

### 4.1 Contract guarantees

- **Zero runtime imports.** Only `import type`. Enforced by a static test that reads the file and fails on any non-type `import`.
- **Deterministic.** No `Date.now()`, no randomness.
- **First-match-wins** on overrides. Caller controls order (services order by `created_at ASC`).
- **Undefined context** falls through to default. Empty context is valid.

### 4.2 Tests — `tests/evaluation/engine.test.ts`

1. Flag off, no overrides → `{enabled: false, reason: 'default'}`.
2. Flag on, no overrides → `{enabled: true, reason: 'default'}`.
3. Override enables a globally-off flag → `{enabled: true, reason: 'override'}`.
4. Override disables a globally-on flag → `{enabled: false, reason: 'override'}`.
5. Multiple overrides — first match wins.
6. Context key not present → fall-through.
7. Empty overrides array → default behaviour.
8. `contextValue === ""` matches `""` but not `undefined`.
9. Static analysis: engine module has zero non-type imports.

### 4.3 Why this matters for Phase 3

Service flow is `db.load(project, env) → FlagEnvironmentState[]` then `state.map(s => evaluateFlag(s, ctx))`. BentoCache in Phase 3 wraps only `db.load`; the engine never changes.

---

## 5. API routes

All paths use JSON bodies. Request/response shapes validated by Zod schemas per module (`*.schema.ts`), typed via `z.infer`. No separate interface declarations.

### 5.1 Client API (client key only)

`projectId` and `environmentId` come from `keyContext`. Clients never pass them in the URL.

| Method | Path                            | Notes                                                                                             |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/client/features`          | Query params become evaluation context. Response: `{ features: [{ name, enabled }] }`.            |
| GET    | `/api/client/features/:flagKey` | Same context handling. Response: `{ name, enabled, reason }`. 404 if flag key unknown in project. |

Reserved/ignored query params: none in Phase 1 — every query param is passed through as context. (Documented as a known limitation; Phase 2 may reserve a namespace.)

### 5.2 Admin API (admin key; root required for project create/delete)

**Projects**

| Method | Path                             | Root only                                                           |
| ------ | -------------------------------- | ------------------------------------------------------------------- |
| POST   | `/api/admin/projects`            | yes                                                                 |
| GET    | `/api/admin/projects`            | no (but returns only projects the key is scoped to, or all if root) |
| GET    | `/api/admin/projects/:projectId` | no                                                                  |
| PATCH  | `/api/admin/projects/:projectId` | no                                                                  |
| DELETE | `/api/admin/projects/:projectId` | yes                                                                 |

**Environments**

| Method | Path                                                         |
| ------ | ------------------------------------------------------------ |
| POST   | `/api/admin/projects/:projectId/environments`                |
| GET    | `/api/admin/projects/:projectId/environments`                |
| DELETE | `/api/admin/projects/:projectId/environments/:environmentId` |

**Flags**

| Method               | Path                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| POST                 | `/api/admin/projects/:projectId/flags`                                                |
| GET                  | `/api/admin/projects/:projectId/flags`                                                |
| GET / PATCH / DELETE | `/api/admin/projects/:projectId/flags/:flagKey`                                       |
| POST                 | `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/enable`  |
| POST                 | `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/disable` |

**Overrides**

| Method | Path                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| POST   | `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides`             |
| GET    | `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides`             |
| DELETE | `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides/:overrideId` |

**API keys**

| Method | Path                                         | Notes                                                                                           |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| POST   | `/api/admin/projects/:projectId/keys`        | Body: `{ type, environmentId?, description? }`. Returns plaintext `key` once, plus prefix/id.   |
| GET    | `/api/admin/projects/:projectId/keys`        | Returns `{ id, prefix, type, environmentId, description, lastUsedAt, createdAt }` — never hash. |
| DELETE | `/api/admin/projects/:projectId/keys/:keyId` |                                                                                                 |

### 5.3 Cross-cutting

- **Error handler.** `setErrorHandler` normalizes to `{ error, message, statusCode }`. Unknown errors → 500, internals not leaked.
- **Validation.** Zod + `zod-to-json-schema` fed to Fastify's validator. 400 with field-level messages.
- **Unique-constraint violations** (project slug, env slug within project, flag key within project, override tuple) → 409 Conflict.
- **Auto-provisioning (in txns):**
  - Creating a project auto-creates `development`, `staging`, `production` environments.
  - Creating a flag auto-creates `flag_environments` rows (all `enabled=false`) for every environment in the project.
- **Enable/disable endpoints** upsert the `flag_environments` row for idempotency (in case the environment was added after the flag).

---

## 6. Config, bootstrap, scaffolding

### 6.1 `src/config.ts`

Loads `.env` via `dotenv`, validates with Zod at module load, fails fast with a clear error. Exported as a frozen object.

| Var            | Required | Default       | Notes                               |
| -------------- | -------- | ------------- | ----------------------------------- |
| `DATABASE_URL` | yes      | —             | Postgres connection string          |
| `PORT`         | no       | `3000`        |                                     |
| `NODE_ENV`     | no       | `development` | `development \| production \| test` |
| `LOG_LEVEL`    | no       | `info`        | pino level                          |

No `BCRYPT_ROUNDS` (bcrypt dropped). No `BOOTSTRAP_ADMIN_KEY` (CLI handles it).

### 6.2 `.env.example`

Ships with placeholders for every variable above, plus a comment pointing to `pnpm admin:create-root-key` after `db:migrate`.

### 6.3 `src/server.ts`

Exports `buildServer(opts?)` (used by tests and prod) and `start()`. `buildServer` registers plugins in order: `db` → `errorHandler` → `auth` → route modules. Tests pass an alternate `db` through `opts` and drive the app via `fastify.inject()`; no HTTP port is opened.

### 6.4 Build & tooling

- **Build:** `tsup` (dual CJS + ESM output, declaration files). `tsup.config.ts` with `format: ['cjs', 'esm']`, `dts: true`, entries `src/server.ts` and `src/cli/create-root-key.ts`.
- **Type-check:** `tsc --noEmit` as a separate `typecheck` script. `tsconfig.json` has `strict: true`, `moduleResolution: "bundler"`, `target: ES2022`.
- **Dev:** `tsx watch src/server.ts` — no bundling in dev loop.
- **Start:** `node dist/server.cjs` by default; package `exports` exposes ESM alongside.

### 6.5 `package.json` scripts

| Script                  | Command                          |
| ----------------------- | -------------------------------- |
| `dev`                   | `tsx watch src/server.ts`        |
| `build`                 | `tsup`                           |
| `start`                 | `node dist/server.cjs`           |
| `typecheck`             | `tsc --noEmit`                   |
| `test`                  | `vitest run`                     |
| `test:watch`            | `vitest`                         |
| `db:generate`           | `drizzle-kit generate`           |
| `db:migrate`            | `drizzle-kit migrate`            |
| `admin:create-root-key` | `tsx src/cli/create-root-key.ts` |

### 6.6 README quickstart

1. `pnpm install`
2. `cp .env.example .env`, fill in `DATABASE_URL`
3. `pnpm db:migrate`
4. `pnpm admin:create-root-key` — save the plaintext key that's printed; it will not be shown again
5. `pnpm dev`
6. Verify with a cURL: `curl -H "Authorization: <root_key>" http://localhost:3000/api/admin/projects`

---

## 7. Testing strategy

### 7.1 Unit — `tests/evaluation/engine.test.ts`

Pure function, no setup. Nine cases listed in § 4.2.

### 7.2 Integration — real Postgres, no mocks

- `tests/helpers/db.ts` reads `TEST_DATABASE_URL`. Before each test file, `TRUNCATE` every table (schema persists across runs for speed). Migrations applied once as a prerequisite, documented in README.
- Tests call `buildServer({ db: testDb })` and drive via `fastify.inject()`.
- Shared fixtures: `createRootKey()`, `createProject(rootKey)`, `createAdminKey(rootKey, projectId)`, `createClientKey(adminKey, projectId, envSlug)`.

### 7.3 Required scenarios

1. **Happy path** — root key → create project (3 envs auto) → create admin key → create flag (3 flag_environments auto) → enable in `staging` → client key scoped to `staging` returns flag enabled; client key scoped to `production` returns disabled.
2. **Override flow** — flag off in env, add override `userId=user_abc123 → true`. `GET …/features?userId=user_abc123` → `enabled: true, reason: 'override'`. `GET …/features?userId=other` → `enabled: false, reason: 'default'`.
3. **Auth scopes** — client key cannot hit admin routes; project-admin cannot touch a different project; project-admin cannot create a project; root can do all.
4. **Conflicts** — duplicate project slug / env slug / flag key / override tuple → 409 with normalized shape.
5. **Cascades** — deleting a project removes envs, flags, flag_environments, overrides, and api_keys for that project.

### 7.4 Out of scope (Phase 1)

Load testing, concurrency stress, cache correctness (no cache yet).

### 7.5 Local/CI database

`docker-compose.yml` ships a Postgres 15 service. README documents both `docker compose up -d` and "point `TEST_DATABASE_URL` at your own Postgres" as supported paths.

---

## 8. Explicitly out of scope for Phase 1

- Rollout strategies (percentage, gradual) — response shape intentionally omits any `strategies` field.
- User segments
- Metrics / impression tracking
- Webhooks, SSE, long-polling
- Admin UI
- Multi-tenancy / org layer

Phase 3 will add BentoCache in front of DB loading without modifying the engine.
