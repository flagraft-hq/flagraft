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

- **SSE push invalidation** — let a flag change reach running SDKs immediately instead of on
  the next poll. The server already clears its own cache on every write, so the delay today is
  the SDK's `ttl` alone: up to 30 seconds by default. That is fine for a gradual rollout and
  poor for a kill switch, which is the case this is for.

  Design settled, not yet built:
  - `GET /api/v1/client/stream`, authenticated with the client key. That key is already scoped
    to one project and environment, so the key is the subscription — no subscribe protocol.
  - The event carries **invalidation, not data** (`{ environmentId, version }`). The server
    cannot push evaluated results because evaluation depends on each caller's context. The SDK
    drops the affected cache entries and refetches, and that refetch is a conditional request,
    so ETag support is what keeps it cheap.
  - The seven existing mutation sites that call `cache.delete`/`deleteByPrefix` collapse into
    one `flagsChanged(projectId, environmentId?)` decorator that clears and publishes together.
  - Opt-in in the SDK (`stream: true`), with reconnect backoff and a fall back to TTL polling
    whenever the stream is down. It must be an optimisation over today's behaviour, never a
    replacement for it.
  - Needs `LISTEN/NOTIFY` (below) to work on more than one server instance.
  - Not usable on Lambda, and awkward on Cloudflare Workers, since it needs a long-lived
    connection. The SDK compatibility table will need a note.

- **Cross-instance cache invalidation via Postgres `LISTEN/NOTIFY`** — see Known limitations.
  Required before SSE can work behind a load balancer, and worth doing on its own merits.

### Operations

- **Audit log** — who changed which flag, when, and in which environment.
- **Evaluation metrics** — optional reporting of which flags were evaluated, so stale flags
  can be found and removed.

### Ecosystem

- **Python and Go SDKs.** Any language can already call the HTTP API directly; these would
  add the same caching and fail-safe behaviour as the TypeScript client.
- **npm release pipeline** for `@flagraft/sdk`.

## Known limitations

- **Cache invalidation does not cross server instances.** The flag-state cache is in-process
  (`bentostore().useL1Layer(memoryDriver())`), with no shared layer and no bus. Every write
  clears the cache on the instance that handled it, so a single-server deployment is always
  consistent. Run two or more behind a load balancer and the other instances keep serving the
  previous state until their own entries expire — up to `CACHE_TTL_SECONDS`, 30 by default.

  Workaround today: run one instance, or lower `CACHE_TTL_SECONDS`. The fix is Postgres
  `LISTEN/NOTIFY`, which needs no new infrastructure since Postgres is already required.

## Not planned

- **Hosted SaaS.** Flagraft is self-hosted by design.
- **Experimentation and analytics.** Flag evaluation is the scope; measuring outcomes belongs
  in your analytics stack.
- **Automatic bulk fetching inside `isEnabled`.** Considered and rejected. Having a single flag
  check pull the whole catalogue helps an app with few distinct contexts and hurts one that
  passes per-user context, where every user would download every flag to answer one question.
  Calling `getFeatures(context)` once already gives the same benefit — later `isEnabled` calls
  with that context are answered from the cached bulk response with no request.
