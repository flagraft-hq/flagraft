# Alpha release checklist

Pre-release audit, 2026-09-20. Work through the sections in order: blockers first,
then should-fix, then minor. Tick items as they land.

## Baseline at time of audit

- `vitest run` (root): 34 files, 417 tests, all pass
- `@flagraft/admin-ui`: 70 files, 664 tests, all pass
- `pnpm typecheck:all`: clean across root, `admin-ui`, `sdk-js`
- `eslint .`: no issues
- No `TODO` / `FIXME` / `HACK` markers anywhere in `src`, `packages`, `tests`, `e2e`, `docs`

Not verified in this audit: the Playwright e2e suite was not run, the Docker image was
not built or booted, and the admin UI and the Unleash import adapter were not
deep-reviewed (their tests pass).

---

## Blockers

### 1. Rate limiter counts the reverse proxy as one client

`src/server.ts:60`, `src/modules/client/client.routes.ts:31`

`Fastify({...})` never sets `trustProxy`, and `@fastify/rate-limit` keys on
`request.ip` by default. Behind nginx, traefik or any load balancer every SDK
instance in the fleet shares a single 100/min bucket and starts getting 429s.

Fixed with a `TRUST_PROXY` env var, off by default, passed to Fastify's
`trustProxy`. It accepts `true`, `false`, a hop count, or a comma-separated list
of proxy addresses and CIDR ranges. Off is the right default in both directions:
with no proxy in front, trusting `X-Forwarded-For` lets any caller invent an IP
per request and bypass the limit entirely.

Keying the limiter on the API key instead of the IP was considered and rejected.
A client key is embedded in frontend bundles, so one key is shared by every
browser running the app — per-key limiting would put thousands of users into a
single 100/min bucket, which is worse than the bug being fixed. Per-IP is the
right unit here; it just needed the real IP.

- [x] Fixed -- `TRUST_PROXY` in `src/config.ts`, applied in `src/server.ts`
- [x] Documented in the README config table, with a "Running behind a reverse proxy" section
- [x] Parsing covered by tests in `tests/config.test.ts`

### 2. Login has no rate limit and no lockout

`src/modules/auth/auth.routes.ts:13`

The rate-limit plugin is registered inside `clientRoutes`, so Fastify
encapsulation confines it to `/api/v1/client/*`. `/admin/auth/login` is
`skipAuth` and completely unthrottled. argon2 is deliberately expensive, so this
is both a credential-stuffing surface and a CPU-exhaustion DoS reachable without
any credential.

Fix: a rate limit on the auth routes, keyed on IP and email. Account lockout is a
larger decision — decide whether it is in scope for alpha.

- [ ] Fixed
- [ ] Documented

### 3. The Docker image cannot migrate itself, and there are no deployment docs

`Dockerfile`, `README.md`

The second stage installs prod dependencies only and copies `dist`, so the image
has no `drizzle-kit`, no `src/db/migrations` and no `drizzle.config.ts`. Anyone
running the image has no way to run `pnpm db:migrate`. The image also never
builds or serves the admin UI.

The README has sixteen headings and none of them is Deployment, Docker or
Production. For a self-hosted product this is the most important missing document.

Fix: decide how migrations run in a container (bundle them and migrate on boot,
or ship a separate migrate entrypoint), decide how the admin UI is served, and
write the deployment section.

- [ ] Migrations reachable from the image
- [ ] Admin UI deployment story decided and implemented
- [ ] README deployment section written

### 4. Cross-origin admin UI is silently broken in production

`src/server.ts:66`, `src/modules/auth/session.ts:8`

`origin: NODE_ENV === 'production' ? false : true` combined with
`sameSite: 'strict'` on the session cookie means the UI must be same-origin with
the API in production. But `VITE_API_URL` is documented as "set it to your own
domain when self-hosting", which implies the opposite. In development the Vite
proxy masks this entirely, so it will not surface until someone deploys.

Fix: either commit to same-origin and ship a reverse-proxy recipe, or add a
`CORS_ORIGIN` env var and relax `sameSite` accordingly. Pick one and document it.

- [ ] Decided and implemented
- [ ] Documented

### 5. README config table is missing required variables

`README.md:184`

Present in `.env.example`, absent from the table the README presents as the
config reference: `JWT_SECRET` (the server refuses to boot without it),
`DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_ADMIN_NAME`,
`DEFAULT_PROJECT_NAME`, `DEFAULT_PROJECT_SLUG`, every `SMTP_*` variable, and
`APP_BASE_URL`.

- [ ] Table completed

### 6. README contradicts the code on environment count

`README.md:38` vs `src/limits.ts:15`

The README says "Each project can have any number of environments". The code caps
it at `MAX_ENVIRONMENTS_PER_PROJECT = 3`, enforced in
`src/modules/environments/environment.service.ts:17` and surfaced in the UI.

Fix: correct the README, or raise the cap. This is front-page copy, so it should
not go out wrong.

- [x] Resolved -- README now says "up to three environments"

---

## Should fix

### 7. ReDoS on the evaluation hot path

`src/modules/client/evaluate.ts:22`

`safeRegexTest` catches syntax errors but not catastrophic backtracking. The
pattern is admin-authored, but the value it is tested against is caller-supplied,
and a client key lives in frontend bundles — effectively public. One crafted
context value against a pattern like `(a+)+$` hangs the event loop for every
evaluation request.

Cheapest fix for alpha: cap pattern and value length, or drop the `regex`
operator until there is a matcher that can be given a timeout.

- [ ] Fixed

### 8. 1MB default body limit on import

No `bodyLimit` is set anywhere, so Fastify's 1MB default applies. A large Unleash
export fails with a raw `FST_ERR_CTP_BODY_TOO_LARGE` rather than a useful message.

Worse, that error fell through the error handler's catch-all and came back as
`500 Internal error`, which reads as a server bug when the real answer is "your
file is too big".

- [x] `MAX_IMPORT_BODY_BYTES` (10MB) in `src/limits.ts`, applied to both import routes
- [x] `FST_ERR_CTP_BODY_TOO_LARGE` now maps to a 413 `PayloadTooLarge`, with a test

### 9. Docker image runs as root and has no HEALTHCHECK

`Dockerfile`

No `USER` directive, and `/ready` exists but nothing is wired to it.

- [ ] Non-root user
- [ ] `HEALTHCHECK` against `/ready`

### 10. Playwright e2e is orphaned

`playwright.config.ts`, `e2e/auth.spec.ts`, `package.json`

`@playwright/test` is a devDependency and the config and spec both exist, but
there is no `test:e2e` script and no CI job. The suite has never run in CI.

Fix: wire it up, or state in the README that it is run manually.

- [x] `pnpm test:e2e` script added
- [ ] CI job, or a README note that it is run manually

### 11. Missing open-source furniture

`.github/` contains only `workflows/`. No `CONTRIBUTING.md`, `SECURITY.md`,
`CHANGELOG.md` or issue templates. There is also no release or publish workflow,
so `@flagraft/sdk` at `0.0.1` has no path to npm.

- [ ] CONTRIBUTING.md
- [ ] SECURITY.md
- [ ] CHANGELOG.md
- [ ] Issue templates
- [ ] SDK publish decision (in or out of scope for alpha)

---

## Minor

### 12. `packages/mcp/` is a local orphan

Contains only `dist/` and `node_modules/`, no `package.json`, untracked by git,
but it matches the `packages/*` workspace glob. Delete it locally.

- [x] Removed

### 13. Session cookie reads `process.env` directly

`src/modules/auth/session.ts:8`

`SESSION_COOKIE_OPTS.secure` reads `process.env.NODE_ENV` at module load instead
of the validated config. It works, but it is the one config read that bypasses
`loadConfig`, which makes it untestable and inconsistent with everything else.

- [ ] Moved onto the config object

### 14. Two migrations share the `0002` prefix

`src/db/migrations/0002_same_misty_knight.sql`,
`src/db/migrations/0002_white_paibok.sql`

Drizzle orders by the journal, so this is harmless today. It is only confusing to
read. Renaming a migration that has already been applied breaks Drizzle's hash
check, so the correct answer is to leave it.

- [x] Deliberately left alone
