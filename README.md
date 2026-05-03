<p align="center">
  <img src="./assets/FR_logo_hd.png" alt="Flagraft Logo" width="300" />
</p>

# Flagraft

Self-hosted feature flag service. Run it on your own infrastructure, point your apps at it, and toggle features without redeploying.

<p align="center">
  <img src="./assets/FR_banner_hd.png" alt="Flagraft Banner" width="800" />
</p>

Built with Node 20, Fastify, Drizzle ORM, and Postgres.

---

## Why self-host feature flags?

SaaS flag services work fine until you hit their pricing tiers, need flags available in an air-gapped environment, or can't send user context to a third party. Flagraft runs on a single Postgres instance and a Node process with no external runtime dependencies.

---

## What's included

**Projects and environments**
Flags are scoped per environment. Each project can have any number of environments (production, staging, preview -- whatever matches your workflow). Deleting an environment cascades cleanly.

**Context-aware overrides**
Pass any key/value context at evaluation time -- user ID, tenant, plan, region -- and get a different flag value back without touching the default. Useful for canary releases and per-tenant rollouts.

**Three-tier auth**

- Root admin keys: full access, created via CLI at setup time
- Project admin keys: scoped to one project, manage flags and overrides
- Client keys: scoped to one project and environment, evaluate flags only

**In-memory caching**
Flag state is cached per `projectId + environmentId` using BentoCache. Any write (flag update, override create/delete, environment delete) invalidates the relevant cache entries automatically. TTL is configurable via `CACHE_TTL_SECONDS`.

**Rate limiting**
Client evaluation routes (`/api/v1/client/*`) are rate-limited per IP. The limit and window are configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. Breaches return a `429` with the standard error envelope.

**Health and readiness endpoints**
`GET /health` returns server uptime. `GET /ready` checks database connectivity and returns `503` if the DB is unreachable. Both endpoints skip auth.

**Graceful shutdown**
The server listens for `SIGTERM` and `SIGINT`, drains in-flight requests via `fastify.close()`, and ends the DB pool before exiting.

**OpenAPI docs**
Swagger UI is served at `/docs` and the OpenAPI JSON spec at `/docs/json`. Both are disabled in production (`NODE_ENV=production`).

---

## Quickstart

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create local config:

   ```sh
   cp .env.example .env
   ```

3. Start Postgres:

   ```sh
   docker compose up -d
   ```

4. Run migrations:

   ```sh
   pnpm db:migrate
   ```

5. Create the root admin key:

   ```sh
   pnpm admin:create-root-key
   ```

   Save the printed key -- it is only shown once.

6. Start the server:

   ```sh
   pnpm dev
   ```

7. Verify it's running:

   ```sh
   curl -H "Authorization: <root_key>" http://localhost:3000/api/v1/admin/projects
   ```

---

## Configuration

All config is read from environment variables. See `.env.example` for the full list.

| Variable               | Default       | Description                                                                                                          |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | --            | Postgres connection string                                                                                           |
| `PORT`                 | `3000`        | Port the server listens on                                                                                           |
| `NODE_ENV`             | `development` | Set to `production` in deployments                                                                                   |
| `LOG_LEVEL`            | `info`        | Pino log level                                                                                                       |
| `CACHE_TTL_SECONDS`    | `30`          | How long flag state is cached per project/environment. Set to `1` to effectively disable caching during development. |
| `RATE_LIMIT_MAX`       | `100`         | Maximum requests per window per IP on client evaluation routes.                                                      |
| `RATE_LIMIT_WINDOW_MS` | `60000`       | Rate limit sliding window duration in milliseconds.                                                                  |

---

## API overview

All routes are under `/api/v1`. Admin routes require a root or project admin key. Client evaluation routes require a client key. Health routes require no auth.

| Method   | Path                                                                                           | Auth    | Description                          |
| -------- | ---------------------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| `GET`    | `/health`                                                                                      | None    | Liveness check                       |
| `GET`    | `/ready`                                                                                       | None    | Readiness check (verifies DB)        |
| `GET`    | `/api/v1/admin/projects`                                                                       | Root    | List all projects                    |
| `POST`   | `/api/v1/admin/projects`                                                                       | Root    | Create a project                     |
| `GET`    | `/api/v1/admin/projects/:projectId/environments`                                               | Project | List environments                    |
| `POST`   | `/api/v1/admin/projects/:projectId/environments`                                               | Project | Create an environment                |
| `GET`    | `/api/v1/admin/projects/:projectId/flags`                                                      | Project | List feature flags                   |
| `POST`   | `/api/v1/admin/projects/:projectId/flags`                                                      | Project | Create a flag                        |
| `POST`   | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/enable`                | Project | Enable a flag in an environment      |
| `POST`   | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/disable`               | Project | Disable a flag in an environment     |
| `POST`   | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/overrides`             | Project | Create an override                   |
| `DELETE` | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/overrides/:overrideId` | Project | Delete an override                   |
| `GET`    | `/api/v1/admin/projects/:projectId/keys`                                                       | Project | List API keys                        |
| `POST`   | `/api/v1/admin/projects/:projectId/keys`                                                       | Project | Create an API key                    |
| `DELETE` | `/api/v1/admin/projects/:projectId/keys/:keyId`                                                | Project | Revoke an API key                    |
| `GET`    | `/api/v1/client/features`                                                                      | Client  | Evaluate all flags for a context     |
| `GET`    | `/api/v1/client/features/:flagKey`                                                             | Client  | Evaluate a single flag for a context |

Pass context as query params on client evaluation endpoints: `?userId=123&plan=pro`.

---

## Client SDKs

- **TypeScript / JavaScript:** [`@flagraft/sdk`](packages/sdk-js/README.md)

---

## Testing

Unit tests run without a database:

```sh
pnpm test
```

Integration tests run when `TEST_DATABASE_URL` is set. With the bundled compose file, the `flagraft_test` database is created automatically on first container startup.

```sh
DATABASE_URL=postgres://flagraft:flagraft@localhost:5432/flagraft_test pnpm db:migrate
TEST_DATABASE_URL=postgres://flagraft:flagraft@localhost:5432/flagraft_test pnpm test
```

---

## Scripts

| Command                      | What it does                                                |
| ---------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                   | Start the server with `tsx watch` (restarts on file change) |
| `pnpm build`                 | Compile to dual ESM/CJS bundles in `dist/`                  |
| `pnpm typecheck`             | Run `tsc` without emitting files                            |
| `pnpm lint`                  | Run ESLint                                                  |
| `pnpm format:check`          | Check formatting with Prettier                              |
| `pnpm db:generate`           | Generate a new Drizzle migration from schema changes        |
| `pnpm db:migrate`            | Apply pending migrations                                    |
| `pnpm admin:create-root-key` | Insert a root admin API key and print it                    |

---

## Troubleshooting

**`relation "api_keys" does not exist`**
Run `pnpm db:migrate` before `pnpm admin:create-root-key`.
