# Self-hosted Docker image — design

Date: 2026-07-22
Status: proposed

## Goal

Ship a single Docker image to a registry (GHCR) so anyone can `docker pull` and run
a complete Flagraft instance — **API + admin web UI + database migrations** — with
minimal friction. Today the image is API-only, does not serve the UI, and cannot
migrate itself, so a fresh pull cannot actually run.

## Decisions (confirmed)

- **Single image.** The API serves the built SPA on the same origin. No second
  container, no reverse proxy, no CORS.
- **Registry: GHCR** — `ghcr.io/flagraft-hq/flagraft`, tagged `:latest` + a version.
- **Baked working defaults** for first-run credentials, overridable by env, with a
  visible "change these" warning (a public image can be exposed to the internet).

## Current state (verified)

- API: Fastify, built to `dist/server.cjs`, listens on `0.0.0.0:3000`. Routes under
  `/api/v1/*`. `start()` in `src/server.ts` boots and, on first boot against an empty
  DB, seeds the default admin + project (`onReady` hook).
- UI: Vite React SPA in `packages/admin-ui`, dev server on 5173. API base is baked at
  build time: `VITE_API_URL ?? 'http://localhost:3000'`; all calls are `/api/...`.
  Built with `VITE_API_URL=''`, calls become same-origin relative `/api/...`.
- Migrations: SQL files in `src/db/migrations`. `drizzle-orm` (prod dep) ships a
  programmatic migrator (`drizzle-orm/node-postgres/migrator`) — no `drizzle-kit`
  needed at runtime.
- Config guards (`src/config.ts`): `JWT_SECRET` required, min 32 chars, no default.
  Production refuses to boot if `NODE_ENV=production` and `DEFAULT_ADMIN_PASSWORD ===
  'flagraft-admin'`. Cache is in-memory (no Redis).

## Design

### 1. API serves the SPA (same origin)

- Add `@fastify/static` (register after routes). Serve `admin-ui/dist` at `/`, with a
  `setNotFoundHandler` (or wildcard) that returns `index.html` for non-`/api`,
  non-`/health` paths so client-side routing works (SPA fallback).
- `/api/*` and `/health` keep their current behavior and take precedence.
- Because the SPA is same-origin, the existing `origin: production ? false : true`
  CORS setting is fine — no cross-origin requests happen.

### 2. Self-migrate at boot

- New tiny entrypoint (`dist/migrate.cjs`, built from `src/db/migrate.ts`) that opens a
  pg pool from `DATABASE_URL`, runs `migrate(db, { migrationsFolder: '<bundled>/migrations' })`,
  and exits. Idempotent — safe on every start.
- Container CMD runs migrate, then `node dist/server.cjs`. A shell entrypoint
  (`docker-entrypoint.sh`: `node dist/migrate.cjs && exec node dist/server.cjs`) keeps
  it one image, one process at a time. Existing first-boot seeding in `server.ts`
  handles the default admin/project after the schema exists.
- Ship the whole `src/db/migrations` folder — including `meta/_journal.json` and the
  `meta/*_snapshot.json` files, which the drizzle migrator reads to order and track
  migrations (SQL files alone are not enough).

### 3. Dockerfile (multi-stage, single final image)

- Builder stage: install all deps, `pnpm build` (API → `dist`), and build the UI with
  `VITE_API_URL=''` (`pnpm --filter admin-ui build` → `packages/admin-ui/dist`).
- Final stage: prod deps only; copy `dist`, `packages/admin-ui/dist`, and
  `src/db/migrations` (including its `meta/` folder). `EXPOSE 3000`. Entrypoint = migrate then serve.

### 4. First-run credentials (baked defaults)

The shipped image bakes working defaults via `ENV`, all overridable:

- `JWT_SECRET` — baked to a fixed 32+ char default, documented as **change in
  production** (baking is required because it has no default and is mandatory).
- `DEFAULT_ADMIN_EMAIL=admin@flagraft.local`, `DEFAULT_ADMIN_NAME=Admin`.
- `DEFAULT_ADMIN_PASSWORD` — baked working default (see open question below).
- README + compose both carry a prominent "change JWT_SECRET and the admin password
  before exposing this publicly" note.

### 5. Compose file for one-command run

`docker-compose.yml` brings up `flagraft` (the image) + `postgres:15`, app depends on a
healthy DB, `DATABASE_URL` points at the pg service. External DB still supported by
overriding `DATABASE_URL` and running the image alone. No Redis service.

### 6. Publish

- GitHub Actions workflow: on tag push, `docker build` + push to
  `ghcr.io/flagraft-hq/flagraft:<version>` and `:latest`.
- README run-block: `docker compose up` (bundled DB) and a raw `docker run` with an
  external `DATABASE_URL`.

## Open question — production mode vs the password guard

`NODE_ENV=production` gives correct prod behavior (locked CORS, no Swagger) but the
config guard rejects the literal `flagraft-admin` password. With baked defaults we
need one of:

- **(Recommended) Run the image as `NODE_ENV=production` and bake a default password
  that is not the guarded literal** (e.g. `DEFAULT_ADMIN_PASSWORD=changeme`). Working
  out-of-the-box creds, guard stays intact for anyone who sets their own, prod behavior
  preserved. README documents the default login.
- Run the image as `NODE_ENV=development` so `flagraft-admin` is accepted. Simplest but
  ships a product in dev mode (reflect-any-origin CORS, Swagger exposed) — not ideal.

## Out of scope (YAGNI)

- Separate UI container / nginx / CDN.
- Redis or any external cache.
- HTTPS/TLS termination (users put their own proxy in front).
- Runtime `VITE_API_URL` injection — same-origin makes it unnecessary.

## Verification

- `docker compose up` on a clean machine → migrations apply, server boots, `GET /`
  serves the SPA, login with baked creds works, a flag evaluation via `/api/v1/client/*`
  returns a result.
- Re-run (existing DB) → migrator is a no-op, no seed duplication.
