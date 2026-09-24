# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Flagraft is pre-1.0. Breaking changes can land in a minor version until 1.0.0.

## [Unreleased]

Nothing yet.

## [0.1.0-alpha.0] - Unreleased

First tagged release. Everything below is the initial feature set rather than a
list of changes, since there is no earlier version to compare against.

### Added

- **Feature flags per project and environment**, with a per-project default
  state for newly created flags. Up to three environments per project.
- **Context-aware targeting** -- ordered strategies with AND-ed constraints over
  typed context fields (string, enum, boolean, number, version, date).
- **Admin UI** -- React application covering projects, flags, environments,
  context fields, targeting, API keys and users.
- **Role-based access control** -- owner, admin, editor and viewer roles, with
  protected environments and a two-admin approval flow for production toggles.
- **Three-tier API keys** -- root admin, project admin and client keys, with
  optional expiry on admin keys.
- **TypeScript SDK** (`@flagraft/sdk`) with TTL caching, a cache size cap,
  stale-on-error fallback, request timeouts, negative caching, rate-limit
  backoff and per-call defaults.
- **Conditional requests** -- `ETag` / `If-None-Match` on the bulk evaluation
  endpoint, handled automatically by the SDK.
- **Import and export** -- a versioned `flagraft.export` document that
  round-trips losslessly, plus a one-way Unleash importer. Every import is
  previewable with `dryRun` and runs in one transaction.
- **In-memory caching** of flag state per project and environment, invalidated
  on every write.
- **Rate limiting** on client evaluation routes, and a separate tighter limit on
  login and the invite routes.
- **OpenAPI / Swagger UI** at `/docs`, disabled in production.
- **Health and readiness endpoints**, graceful shutdown, and selective request
  logging.
- `TRUST_PROXY` so the rate limiter reads the real client IP behind a reverse
  proxy instead of counting the whole deployment as one caller.
- Docker image now runs as a non-root user and carries a `HEALTHCHECK` against
  `/ready`.

### Security

- Regex targeting constraints are screened when saved. A pattern that can
  backtrack exponentially is rejected, because evaluation runs it against
  caller-supplied context on every request.
- Login and the two invite routes are rate limited separately from client
  traffic. Both run argon2, so an unthrottled caller could guess credentials and
  exhaust CPU at the same time.

### Fixed

- Rate limit breaches returned `500 Internal error` instead of `429`. The error
  handler discarded the status of anything thrown that was not a known error
  class, and `@fastify/rate-limit` signals a breach by throwing a plain object.
- Oversized request bodies returned `500` instead of `413`. The import routes
  also now accept up to 10MB, since a real Unleash export goes past Fastify's
  1MB default.

[unreleased]: https://github.com/flagraft-hq/flagraft/compare/v0.1.0-alpha.0...HEAD
[0.1.0-alpha.0]: https://github.com/flagraft-hq/flagraft/releases/tag/v0.1.0-alpha.0
