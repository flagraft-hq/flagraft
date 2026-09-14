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
- **Import and export** — a versioned `flagraft.export` document that round-trips losslessly,
  plus a one-way importer for [Unleash](https://www.getunleash.io) exports and an Unleash-shaped
  export. Every import is previewable with `dryRun`, runs in one transaction, and reports anything
  it could not represent rather than approximating it — a strategy that cannot be carried over
  exactly is dropped, never widened. See [API.md](API.md#import-and-export).
- **MCP server** -- [`@flagraft/mcp`](../packages/mcp), a stdio MCP server over the admin API so a
  coding agent can list, create and toggle flags while writing the code behind them. Reads,
  plus create and toggle; no delete tool and no strategy writes, because an agent that can drop a
  project or quietly rewrite a rollout is a worse trade than opening the admin UI for the rare
  destructive change.
- **OpenAPI / Swagger UI** at `/docs`.

## Planned

### Evaluation

- **Percentage rollouts** — deterministic bucketing on a context field so a flag can be
  enabled for a stable subset of users. The Unleash importer skips `flexibleRollout` below
  100% today and will map it once this exists, so this is worth more than it looks: it is
  the single most common reason an Unleash migration comes out incomplete.
- **Flag variants** — beyond boolean, returning a string or JSON value per matched strategy.
  The Unleash importer drops variants today and will map them once this exists.
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

- **Configurable shared cache layer** — the flag-state cache is in-process only. BentoCache,
  already the cache in use, is a two-tier design: L1 is local memory, L2 is a shared store, and
  a bus keeps every instance's L1 in step. Only L1 is wired up today.

  What the operator would choose:
  - **Nothing** — today's behaviour, and the right answer for a single instance. Must stay the
    default: requiring Redis to run a flag server would be a poor trade.
  - **Redis as L2**, with the Redis bus for invalidation. The usual choice once more than one
    instance is running.
  - **A database table as L2**, via BentoCache's `database` driver, for deployments that will
    not add Redis. Slower than Redis and it needs a bus of its own, which is where
    `LISTEN/NOTIFY` fits — the two items are the same piece of work approached from either end.

  There is no third tier to configure: BentoCache stops at L1 and L2, so "Redis and the
  database" is a choice between them for the L2 slot, not a stack of both. Postgres is already
  a hard dependency and holds the truth anyway, so a miss at L2 falls through to a query, which
  is the layer a notional L3 would have been.

  The point of L2 is not speed — an in-memory hit is far quicker than a Redis round trip. It is
  that a cold or restarted instance warms from a shared store instead of hammering Postgres,
  and that invalidation reaches every instance at once.

### Operations

- **Audit log** — who changed which flag, when, and in which environment. A stored record with
  an actor and a before/after, queryable from the admin UI and filterable by project,
  environment and actor. Not application logs: those answer "what happened to this request",
  and the question here is "who turned this on last Thursday". Writes only — flag and strategy
  changes, key creation and revocation, role and membership changes, approval decisions. Read
  traffic is deliberately excluded; the evaluation endpoint is polled on a timer and logging it
  would bury everything worth reading.

- **SSO via OIDC** — sign in through an existing identity provider (Keycloak, Okta, Entra,
  Google Workspace) instead of managing a second set of passwords. Sketch:
  - Authorization code flow with PKCE, landing on the same session cookie the local login
    already issues, so nothing downstream of authentication changes.
  - IdP groups map to the existing owner / admin / editor / viewer roles, configured per
    deployment. Roles stay Flagraft's, not the IdP's.
  - Local accounts keep working alongside it. An SSO outage must never lock an operator out of
    their own kill switches.
  - SAML and SCIM provisioning are a separate, larger job and not part of this.
  - Not a paid tier. Charging for the login that makes a self-hosted tool usable in a company
    is the pattern this project exists to avoid.

- **Evaluation metrics** — optional reporting of which flags were evaluated, so stale flags
  can be found and removed.

### Ecosystem

- **React SDK** — `@flagraft/react`, a thin wrapper over the existing TypeScript client rather
  than a second implementation. A provider that hydrates the whole flag list in one call, a
  `useFlag(key, default)` hook that re-renders on change, and SSR support so the server-rendered
  markup and the first client render agree instead of flickering. The browser constraints drive
  the design: a client key shipped to a browser is public, so it must stay a client key scoped
  to one environment, and the evaluation context is whatever the page already knows about the
  user.
- **Python and Go SDKs.** Any language can already call the HTTP API directly; these would
  add the same caching and fail-safe behaviour as the TypeScript client: TTL cache with a size
  cap, stale-on-error, request timeouts, negative caching, rate-limit backoff and per-call
  defaults. Idiomatic where it matters — a context manager and type hints in Python, a
  `context.Context` on every call in Go — but the same behaviour under failure, since an SDK
  that fails differently per language is worse than no SDK.
- **npm release pipeline** for `@flagraft/sdk`.

## Known limitations

- **Cache invalidation does not cross server instances.** The flag-state cache is in-process
  (`bentostore().useL1Layer(memoryDriver())`), with no shared layer and no bus. Every write
  clears the cache on the instance that handled it, so a single-server deployment is always
  consistent. Run two or more behind a load balancer and the other instances keep serving the
  previous state until their own entries expire — up to `CACHE_TTL_SECONDS`, 30 by default.

  Workaround today: run one instance, or lower `CACHE_TTL_SECONDS`. The fix is Postgres
  `LISTEN/NOTIFY`, which needs no new infrastructure since Postgres is already required, or a
  BentoCache bus over Redis for deployments that already run one — see Configurable shared
  cache layer.

## Not planned

- **Hosted SaaS.** Flagraft is self-hosted by design.
- **Experimentation and analytics.** Flag evaluation is the scope; measuring outcomes belongs
  in your analytics stack.
- **Automatic bulk fetching inside `isEnabled`.** Considered and rejected. Having a single flag
  check pull the whole catalogue helps an app with few distinct contexts and hurts one that
  passes per-user context, where every user would download every flag to answer one question.
  Calling `getFeatures(context)` once already gives the same benefit — later `isEnabled` calls
  with that context are answered from the cached bulk response with no request.
