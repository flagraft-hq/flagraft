<p align="center">
  <img src="./assets/FR_banner.png" alt="Flagraft, an open source self-hosted feature flag management service for Node.js, TypeScript, and Postgres" width="500" />
</p>

# Flagraft: Open Source Self-Hosted Feature Flag Management

> **Open source feature flag service for Node.js and TypeScript.** Self-host feature flags, feature toggles, kill switches, A/B tests, canary releases, and gradual rollouts on your own Postgres database, with a typed SDK and zero vendor lock-in.

<p align="center">
  <a href="./packages/sdk-js"><img alt="@flagraft/sdk status" src="https://img.shields.io/badge/%40flagraft%2Fsdk-alpha-f59e0b"></a>
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
Flags are scoped per environment. Each project can have up to three environments (production, staging, preview -- whatever matches your workflow). Deleting an environment cascades cleanly.

**Context-aware targeting**
Pass any key/value context at evaluation time -- user ID, tenant, plan, region -- and match it against per-environment targeting strategies to turn a flag on for a subset of callers. Useful for canary releases and per-tenant rollouts.

**Three-tier auth**

- Root admin keys: full access, created via CLI at setup time
- Project admin keys: scoped to one project, manage flags, context fields, and strategies
- Client keys: scoped to one project and environment, evaluate flags only

**Import and export**
Every project exports to a versioned JSON document that round-trips losslessly -- for backups, restores, or cloning a project into another install. A separate one-way importer reads [Unleash](https://www.getunleash.io) exports, so trying Flagraft does not mean re-entering every flag by hand. See [Import and export](#import-and-export) below.

**In-memory caching**
Flag state is cached per `projectId + environmentId` using BentoCache. Any write (flag update, strategy change, environment delete) invalidates the relevant cache entries automatically. TTL is configurable via `CACHE_TTL_SECONDS`.

**Rate limiting**
Client evaluation routes (`/api/v1/client/*`) are rate-limited per IP, configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. The unauthenticated routes that verify a password or an invite token -- login, and the two invite endpoints -- get a separate, much tighter limit via `AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_MS`, because those run argon2 and are worth both guessing at and exhausting CPU with. Breaches return a `429` with the standard error envelope. Behind a proxy, set `TRUST_PROXY` or every caller counts as one.

**Logging**
Only the requests worth reading are logged: any `5xx`, and anything slower than 500ms. Successful and `4xx` responses are silent, because the client evaluation endpoint is polled on a timer by every SDK instance -- a line per request is thousands a second describing nothing wrong, and it buries the events an operator needs. Set `REQUEST_LOG=true` to log every request while debugging. `5xx` errors are always logged with their stack, whatever the setting.

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
- **A/B testing infrastructure.** Use targeting strategies to direct cohorts to different variants and read the flag from your analytics pipeline.
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
| Context-aware targeting | Built-in              | Built-in     | Built-in      | Built-in      | Built-in   |
| Official TypeScript SDK | `@flagraft/sdk`       | Yes          | Yes           | Yes           | Yes        |
| Admin UI                | Built in              | Yes          | Yes           | Yes           | Yes        |
| OpenAPI / Swagger UI    | Yes, at `/docs`       | Partial      | Yes           | Yes           | Yes        |
| External services       | Just Postgres         | SaaS         | Postgres + UI | Postgres + UI | SaaS       |
| Lines of server code    | Small (auditable)     | Closed       | Large         | Large         | Closed     |

Pick Flagraft when you want a minimal, auditable, self-hosted feature flag service you can drop next to your existing Node/Postgres stack. Pick a hosted vendor when you need turnkey analytics or percentage-based rollout strategies today — see the [roadmap](docs/ROADMAP.md) for what is planned here.

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

## First Setup

When the server starts with an empty database, it automatically creates:

- A default admin account
- A default project named **Default** with Development and Production environments

### Default admin credentials

| Field    | Default value          |
| -------- | ---------------------- |
| Email    | `admin@flagraft.local` |
| Password | `flagraft-admin`       |

**Change the password immediately after your first login.**

Override any defaults with environment variables before first boot:

```env
DEFAULT_ADMIN_EMAIL=you@yourcompany.com
DEFAULT_ADMIN_PASSWORD=your-secure-password
DEFAULT_ADMIN_NAME=Your Name
DEFAULT_PROJECT_NAME=My Project
DEFAULT_PROJECT_SLUG=my-project
```

The seed only runs when the database is empty. Restarting the server later will not overwrite anything.

---

## Configuration

All config is read from environment variables. `.env.example` is a copyable
starting point with the same list.

Two have no default and the server refuses to start without them: `DATABASE_URL`
and `JWT_SECRET`.

### Core

| Variable       | Default       | Description                                                                                                                                                                                           |
| -------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | --            | **Required.** Postgres connection string.                                                                                                                                                             |
| `JWT_SECRET`   | --            | **Required.** Signs the admin session cookie. At least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Changing it signs every user out. |
| `PORT`         | `3000`        | Port the server listens on.                                                                                                                                                                           |
| `NODE_ENV`     | `development` | Set to `production` in deployments. Also disables Swagger UI at `/docs`.                                                                                                                              |
| `LOG_LEVEL`    | `info`        | Pino log level.                                                                                                                                                                                       |
| `REQUEST_LOG`  | `false`       | Log a line for every request. Off by default: `5xx` and slow requests are logged either way.                                                                                                          |

### Caching and rate limiting

| Variable                    | Default  | Description                                                                                                          |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `CACHE_TTL_SECONDS`         | `30`     | How long flag state is cached per project/environment. Set to `1` to effectively disable caching during development. |
| `RATE_LIMIT_MAX`            | `100`    | Maximum requests per window per IP on client evaluation routes.                                                      |
| `RATE_LIMIT_WINDOW_MS`      | `60000`  | Rate limit sliding window duration in milliseconds.                                                                  |
| `TRUST_PROXY`               | off      | How much of `X-Forwarded-For` to believe when working out the caller's IP. See below.                                |
| `AUTH_RATE_LIMIT_MAX`       | `20`     | Maximum attempts per window per IP on login and the invite routes.                                                   |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Window for that limit, in milliseconds. Default is 15 minutes.                                                       |

### First-boot seed

Applied only when the server starts against an empty database. Changing them
later does nothing -- see [First Setup](#first-setup).

| Variable                 | Default                | Description                                                                                                                          |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DEFAULT_ADMIN_EMAIL`    | `admin@flagraft.local` | Email of the admin account created on first boot.                                                                                    |
| `DEFAULT_ADMIN_PASSWORD` | `flagraft-admin`       | Password for that account. The default is published in these docs, so the server refuses to start in production until you change it. |
| `DEFAULT_ADMIN_NAME`     | `Admin`                | Display name for that account.                                                                                                       |
| `DEFAULT_PROJECT_NAME`   | `Default`              | Name of the project created on first boot.                                                                                           |
| `DEFAULT_PROJECT_SLUG`   | `default`              | Slug of that project.                                                                                                                |

### Email (optional)

Used to send user invites. Leave `SMTP_HOST` unset to disable email entirely:
invites still work, and the admin shares the invite link by hand instead.

| Variable       | Default | Description                                                                                                                                                                   |
| -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`    | unset   | SMTP server hostname. Unset disables email.                                                                                                                                   |
| `SMTP_PORT`    | `587`   | SMTP server port.                                                                                                                                                             |
| `SMTP_SECURE`  | `false` | Use TLS on connect. Set `true` for port 465.                                                                                                                                  |
| `SMTP_USER`    | unset   | SMTP username.                                                                                                                                                                |
| `SMTP_PASS`    | unset   | SMTP password.                                                                                                                                                                |
| `SMTP_FROM`    | unset   | From address on invite emails, e.g. `Flagraft <no-reply@yourcompany.com>`. Falls back to `SMTP_USER`, then `no-reply@flagraft.local`.                                         |
| `APP_BASE_URL` | unset   | Public URL of the admin UI, used to build the invite link. Falls back to the origin of the request that created the invite, so this is only needed when that origin is wrong. |

### Running behind a reverse proxy

The rate limit above is counted per caller IP. Behind nginx, traefik, a cloud load
balancer or any other proxy, every request arrives from the proxy's address, so
without `TRUST_PROXY` your entire deployment shares a single bucket and legitimate
SDK traffic starts getting `429`s.

Set `TRUST_PROXY` so the server reads the real client IP from `X-Forwarded-For`:

```env
# Trust one hop -- correct when exactly one proxy you control is in front.
TRUST_PROXY=1

# Or name the proxies explicitly.
TRUST_PROXY=10.0.0.0/8,192.168.1.1
```

It is off by default on purpose, and leaving it off is right when you have no
proxy: `X-Forwarded-For` is caller-supplied, so a server that trusts it with
nothing in front lets anyone invent a fresh IP per request and bypass the rate
limit entirely. Turn it on only when a proxy you control is actually there.

The admin UI is a separate build and reads one variable of its own, at build
time rather than at run time:

| Variable       | Default                 | Description                                                                                                                                                                         |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | `http://localhost:3000` | Origin of the Flagraft API the admin UI talks to. Also the endpoint it shows on the Environments screen and in the API-key snippet, so set it to your own domain when self-hosting. |

---

## API overview

All routes are under `/api/v1`. Admin routes require a root or project admin key. Client evaluation routes require a client key. Health routes require no auth.

| Method   | Path                                                                                | Auth    | Description                          |
| -------- | ----------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| `GET`    | `/health`                                                                           | None    | Liveness check                       |
| `GET`    | `/ready`                                                                            | None    | Readiness check (verifies DB)        |
| `GET`    | `/api/v1/admin/projects`                                                            | Root    | List all projects                    |
| `POST`   | `/api/v1/admin/projects`                                                            | Root    | Create a project                     |
| `GET`    | `/api/v1/admin/projects/:projectId/environments`                                    | Project | List environments                    |
| `POST`   | `/api/v1/admin/projects/:projectId/environments`                                    | Project | Create an environment                |
| `GET`    | `/api/v1/admin/projects/:projectId/flags`                                           | Project | List feature flags                   |
| `POST`   | `/api/v1/admin/projects/:projectId/flags`                                           | Project | Create a flag                        |
| `POST`   | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/enable`     | Project | Enable a flag in an environment      |
| `POST`   | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/disable`    | Project | Disable a flag in an environment     |
| `GET`    | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/strategies` | Project | List targeting strategies            |
| `PUT`    | `/api/v1/admin/projects/:projectId/flags/:flagKey/environments/:envSlug/strategies` | Project | Replace targeting strategies         |
| `GET`    | `/api/v1/admin/projects/:projectId/context-fields`                                  | Project | List context fields                  |
| `POST`   | `/api/v1/admin/projects/:projectId/context-fields`                                  | Project | Create a context field               |
| `PATCH`  | `/api/v1/admin/projects/:projectId/context-fields/:fieldId`                         | Project | Update a context field               |
| `DELETE` | `/api/v1/admin/projects/:projectId/context-fields/:fieldId`                         | Project | Delete a context field               |
| `GET`    | `/api/v1/admin/projects/:projectId/keys`                                            | Project | List API keys                        |
| `POST`   | `/api/v1/admin/projects/:projectId/keys`                                            | Project | Create an API key                    |
| `DELETE` | `/api/v1/admin/projects/:projectId/keys/:keyId`                                     | Project | Revoke an API key                    |
| `GET`    | `/api/v1/client/features`                                                           | Client  | Evaluate all flags for a context     |
| `GET`    | `/api/v1/client/features/:flagKey`                                                  | Client  | Evaluate a single flag for a context |

Pass context as query params on client evaluation endpoints: `?tenant=phyg&plan=pro`. The server
matches the context against each flag's **targeting strategies** for that environment (only keys
registered as **context fields** are considered). A flag is on when the environment is enabled and
either has no strategies (on for everyone) or at least one strategy whose constraints all match.
The single-flag response includes a `reason`: `strategy-match`, `default`, or `disabled`.

Targeting strategies are managed per flag + environment via the `strategies` endpoint (PUT replaces
the whole ordered list). Each strategy is a set of constraints (`fieldKey`, `operator`, `values`)
that AND together; multiple strategies OR together.

---

## Import and export

Two surfaces that deliberately share nothing but their report format.

**Native** -- `GET` and `POST` on `/api/v1/admin/projects/:id/transfer/export|import`. A
`flagraft.export` v1 document holding flags, per-environment states, targeting strategies and
context fields. It round-trips exactly: export a project, import it into an empty one, export
again, and you get the same document back. Ids, timestamps, API keys, users and project settings
are deliberately left out, so a file is safe to hand around and lands in any project on any
install.

**External tools** -- `/transfer/export|import/unleash`. Unleash is the only tool supported today;
a second one becomes another route pair, not a rewrite. There is no `format` parameter and no
format sniffing: each endpoint accepts exactly one shape, and points you at the other route if you
bring the wrong file.

In the admin UI this is two controls on the flags screen -- **Export** and **Import** -- each with a
format field inside it. From an operator's side it is one job either way; which tool the file
belongs to is a property of the file, not a different task.

Three properties worth knowing before you run one:

- **Every import is previewable.** `dryRun: true` runs the identical code path inside the
  transaction and rolls it back, returning the report it would have returned. The UI always
  previews first and only writes when you confirm.
- **It is one transaction.** A half-imported project -- some flags created, some strategies
  missing -- is impossible rather than recoverable.
- **Import never widens a flag's audience.** Flagraft has no variants, percentage rollouts or
  segments, so an Unleash export cannot be carried over whole. Rather than approximate, any
  strategy that cannot be represented exactly is dropped and named in the report. Importing a 50%
  rollout as an always-on rule would double who sees a feature, which is not a mistake worth
  making quietly. Same for a constraint we cannot express: the whole strategy goes, because
  dropping one AND-ed condition broadens the rest.

Protected environments keep their guarantees. If the project requires two admins to confirm a
production toggle, an import will not flip one -- it reports those as `approval-required` and
leaves them alone.

No new configuration: nothing is added to the [Configuration](#configuration) table, and there is nothing new to put in `.env`.

Full endpoint reference, the report shape, and the complete Unleash mapping tables are in
[docs/API.md](docs/API.md#import-and-export).

---

## Client SDKs

- **TypeScript / JavaScript:** [`@flagraft/sdk`](packages/sdk-js/README.md)

Flagraft is in alpha, so the SDK publishes under the `alpha` dist-tag rather than
`latest`:

```sh
pnpm add @flagraft/sdk@alpha
```

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
Yes, for the core feature flag management workflow (toggle features per environment, target users via context, evaluate from server or client SDK). See [How Flagraft compares](#how-flagraft-compares) for a feature-by-feature table. Some advanced capabilities (percentage rollouts, real-time SSE push, audit log) are on the [roadmap](docs/ROADMAP.md).

**Does Flagraft work for A/B testing and canary releases?**
Yes. Use context-aware targeting strategies keyed by `userId`, `cohort`, `region`, `tenant`, or any custom context field to direct subsets of users to a variant or canary. The evaluation engine returns a deterministic on/off per (flag, context) pair.

**What languages and frameworks are supported?**
Any language can call the HTTP API directly. Today the official SDK is TypeScript / JavaScript via [`@flagraft/sdk`](packages/sdk-js/README.md), works with Node 20+, Bun, Deno, Cloudflare Workers, and Vercel Edge. Python and Go SDKs are on the [roadmap](docs/ROADMAP.md).

**Does Flagraft support context-aware targeting (user, tenant, plan, region)?**
Yes. The evaluation engine accepts a `Record<string, string>` context on every call and matches it against targeting strategies stored per flag and environment.

**How does Flagraft handle high traffic on the evaluation hot path?**
Flag state is cached in-process on the server using BentoCache, keyed by `projectId + environmentId`, and invalidated on writes. The TypeScript SDK adds a second layer of in-process TTL caching on the consumer side, which means typical reads never touch the database.

**Is there an admin UI for non-technical team members?**
Yes. Flagraft ships a React admin UI ([`@flagraft/admin-ui`](packages/admin-ui)) covering projects, flags, environments, context fields, targeting strategies, API keys and user management with role-based access. Everything it does is also available over the HTTP API, or through the Swagger UI at `/docs`.

**Can Flagraft run in an air-gapped or compliance-restricted environment?**
Yes. Flagraft has no external runtime dependencies beyond Postgres, sends no telemetry, and can run fully behind your firewall.

**What is the license?**
[MIT](./LICENSE), for the server, the admin UI and the SDK alike. Use it commercially, modify it, fork it, embed the SDK in closed-source applications. Your flag configuration is your data and is not covered by anything here.

---

<sub>**Topics:** feature flags, feature flag management, feature toggles, self-hosted feature flags, open source feature flags, A/B testing, canary release, gradual rollout, dark launch, kill switch, progressive delivery, LaunchDarkly alternative, Unleash alternative, Flagsmith alternative, ConfigCat alternative, Node.js feature flag server, TypeScript feature flag SDK, Postgres feature flags, feature management platform, trunk-based development.</sub>
