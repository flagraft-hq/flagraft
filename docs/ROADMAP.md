# Roadmap

What exists today, and what is planned. No dates — this is a statement of intent, not a
commitment. Items move only when they are actually done.

## Shipped

- **Feature flags per project and environment** — create, toggle, delete, with a per-project
  default state for new flags.
- **Context-aware targeting** — ordered strategies with AND-ed constraints over typed context
  fields (string, enum, boolean, number, version, date).
- **Admin UI** — React application covering projects, flags, environments, context fields,
  targeting, API keys and users.
- **Role-based access control** — owner, admin, editor and viewer roles, with protected
  environments and a two-admin approval flow for production toggles.
- **Three-tier API keys** — root admin, project admin and client keys, with optional TTL on
  admin keys.
- **TypeScript SDK** — [`@flagraft/sdk`](../packages/sdk-js), with TTL caching, a cache size
  cap, stale-on-error fallback, request timeouts, negative caching for unknown flags,
  rate-limit backoff and per-call default values.
- **Conditional requests** — `ETag` / `If-None-Match` on the bulk evaluation endpoint, so an
  unchanged flag list costs a 304 with no body. Handled automatically by the SDK.
- **OpenAPI / Swagger UI** at `/docs`.

## Planned

### Evaluation

- **Percentage rollouts** — deterministic bucketing on a context field so a flag can be
  enabled for a stable subset of users.
- **Flag variants** — beyond boolean, returning a string or JSON value per matched strategy.
- **Constraint-level evaluation detail** — report _which_ constraint failed, so "why is this
  off for this user" is answerable without re-deriving the strategy by hand.

### Delivery and freshness

- **SSE push invalidation** — replace TTL polling so flag changes reach SDKs immediately.
  Today, freshness is bounded by the server cache TTL plus the SDK TTL.

### Operations

- **Audit log** — who changed which flag, when, and in which environment.
- **Evaluation metrics** — optional reporting of which flags were evaluated, so stale flags
  can be found and removed.

### Ecosystem

- **Python and Go SDKs.** Any language can already call the HTTP API directly; these would
  add the same caching and fail-safe behaviour as the TypeScript client.
- **npm release pipeline** for `@flagraft/sdk`.

## Not planned

- **Hosted SaaS.** Flagraft is self-hosted by design.
- **Experimentation and analytics.** Flag evaluation is the scope; measuring outcomes belongs
  in your analytics stack.
