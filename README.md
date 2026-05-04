<p align="center">
  <img src="./assets/FR_banner_hd.png" alt="Flagraft, an open source self-hosted feature flag management service for Node.js, TypeScript, and Postgres" width="500" />
</p>

# Flagraft: Open Source Self-Hosted Feature Flag Management

> **Open source feature flag service for Node.js and TypeScript.** Self-host feature flags, feature toggles, kill switches, A/B tests, canary releases, and gradual rollouts on your own Postgres database, with a typed SDK and zero vendor lock-in.

<p align="center">
  <a href="./packages/sdk-js"><img alt="@flagraft/sdk status" src="https://img.shields.io/badge/%40flagraft%2Fsdk-in_development-f59e0b"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2dd4bf"></a>
  <a href="#"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-2dd4bf"></a>
  <a href="#"><img alt="built with" src="https://img.shields.io/badge/built_with-Fastify%20%E2%80%A2%20Drizzle%20%E2%80%A2%20Postgres-2dd4bf"></a>
</p>

Flagraft is a **self-hosted feature flag platform** that lets engineering teams ship features safely without redeploying. Run it on your own infrastructure, point your apps at it through the official **TypeScript SDK** or plain HTTP, and toggle features per environment, per user, or per tenant in real time.

If you have ever wanted a [LaunchDarkly](#how-flagraft-compares), [Unleash](#how-flagraft-compares), [Flagsmith](#how-flagraft-compares), or [ConfigCat](#how-flagraft-compares) alternative that you fully control, runs in air-gapped environments, and does not bill per seat, Flagraft is built for you.

**Built with:** Node 20, Fastify, Drizzle ORM, Zod, BentoCache, and Postgres 15.

---

## Why self-host your feature flag service?

SaaS feature flag tools work fine until you hit their pricing tiers, need flags evaluated inside an air-gapped or regulated environment, or cannot legally send user context (PII, tenant data, region) to a third party. Flagraft solves all three:

- **No vendor lock-in.** It is your data, your database, your uptime.
- **Air-gapped friendly.** Runs on a single Postgres instance and a Node process with no external runtime dependencies.
- **Pay nothing per seat or per flag.** Open source, MIT-style permissive use.
- **Built for context-aware targeting.** Every evaluation can take a context object (user ID, tenant, plan, region, cohort) so canary releases and per-tenant rollouts work out of the box.

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

## Use cases

Flagraft is designed around the patterns engineering teams actually use feature flags for:

- **Kill switches and circuit breakers.** Disable a misbehaving feature in production within seconds, no redeploy.
- **Gradual rollouts and canary releases.** Enable a feature for a small set of users (by `userId`, `cohort`, or `region`), then expand as you gain confidence.
- **A/B testing infrastructure.** Use overrides to direct cohorts to different variants and read the flag from your analytics pipeline.
- **Per-tenant rollouts.** Enable features for specific tenants in a multi-tenant SaaS, useful for paid-tier gating or trusted-customer previews.
- **Trunk-based development.** Merge incomplete features behind a flag and ship them dark; flip when ready.
- **Environment promotion.** Keep separate flag state for `development`, `staging`, and `production` without duplicating config across services.
- **Feature deprecation.** Wrap a deprecated path in a flag, disable for new users, monitor, then remove.

---

## How Flagraft compares

Flagraft is a deliberately small, focused alternative to the well-known feature flag platforms. Here is where it lands:

| Capability              | Flagraft              | LaunchDarkly | Unleash (OSS) | Flagsmith     | ConfigCat  |
| ----------------------- | --------------------- | ------------ | ------------- | ------------- | ---------- |
| Self-hosted             | Yes (single Postgres) | No (SaaS)    | Yes           | Yes           | Yes (paid) |
| Open source             | Yes (MIT-style)       | No           | Yes (Apache)  | Yes (BSD)     | No         |
| Per-seat pricing        | None                  | Yes          | None (OSS)    | None (OSS)    | Yes        |
| Context-aware overrides | Built-in              | Built-in     | Built-in      | Built-in      | Built-in   |
| Official TypeScript SDK | `@flagraft/sdk`       | Yes          | Yes           | Yes           | Yes        |
| OpenAPI / Swagger UI    | Yes, at `/docs`       | Partial      | Yes           | Yes           | Yes        |
| External services       | Just Postgres         | SaaS         | Postgres + UI | Postgres + UI | SaaS       |
| Lines of server code    | Small (auditable)     | Closed       | Large         | Large         | Closed     |

Pick Flagraft when you want a minimal, auditable, self-hosted feature flag service you can drop next to your existing Node/Postgres stack. Pick a hosted vendor when you need turnkey analytics, percentage-based rollout strategies, or a polished admin UI today (the [Flagraft admin UI is on the roadmap](docs/ROADMAP.md)).

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

---

## FAQ

**Is Flagraft a free, open source feature flag service?**
Yes. Flagraft is open source and self-hosted. There is no SaaS tier, no per-seat fee, and no telemetry sent home.

**Can I use Flagraft as a LaunchDarkly, Unleash, Flagsmith, or ConfigCat alternative?**
Yes, for the core feature flag management workflow (toggle features per environment, target users via context, evaluate from server or client SDK). See [How Flagraft compares](#how-flagraft-compares) for a feature-by-feature table. Some advanced capabilities (percentage rollouts, real-time SSE push, audit log, admin UI) are on the [roadmap](docs/ROADMAP.md).

**Does Flagraft work for A/B testing and canary releases?**
Yes. Use context-aware overrides keyed by `userId`, `cohort`, `region`, or any custom attribute to direct subsets of users to a variant or canary. The evaluation engine returns a deterministic on/off per (flag, context) pair.

**What languages and frameworks are supported?**
Any language can call the HTTP API directly. Today the official SDK is TypeScript / JavaScript via [`@flagraft/sdk`](packages/sdk-js/README.md), works with Node 20+, Bun, Deno, Cloudflare Workers, and Vercel Edge. Python and Go SDKs are on the [roadmap](docs/ROADMAP.md).

**Does Flagraft support context-aware targeting (user, tenant, plan, region)?**
Yes. The evaluation engine accepts a `Record<string, string>` context on every call and matches it against override rules stored per environment.

**How does Flagraft handle high traffic on the evaluation hot path?**
Flag state is cached in-process on the server using BentoCache, keyed by `projectId + environmentId`, and invalidated on writes. The TypeScript SDK adds a second layer of in-process TTL caching on the consumer side, which means typical reads never touch the database.

**Is there an admin UI for non-technical team members?**
Not yet. The admin UI is planned for Phase 5 of the [roadmap](docs/ROADMAP.md). Today, flag and override management is done via the HTTP API or Swagger UI at `/docs`.

**Can Flagraft run in an air-gapped or compliance-restricted environment?**
Yes. Flagraft has no external runtime dependencies beyond Postgres, sends no telemetry, and can run fully behind your firewall.

**What is the license?**
MIT-style permissive license. Use it commercially, modify it, fork it.

---

<sub>**Topics:** feature flags, feature flag management, feature toggles, self-hosted feature flags, open source feature flags, A/B testing, canary release, gradual rollout, dark launch, kill switch, progressive delivery, LaunchDarkly alternative, Unleash alternative, Flagsmith alternative, ConfigCat alternative, Node.js feature flag server, TypeScript feature flag SDK, Postgres feature flags, feature management platform, trunk-based development.</sub>
