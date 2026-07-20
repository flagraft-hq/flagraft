# Phase 3 — Targeting Strategies (Unleash-style) Implementation Plan

**Goal:** Make context fields drive flag evaluation via **activation strategies**, following
Unleash's model. Each flag+environment has a master enable toggle (already exists) plus a list of
strategies; each strategy is a set of AND-constraints on registered context fields. Re-activates the
evaluation context that Phase 1 stripped.

**This reverses the Phase 1/2 scope decision** that context fields had no evaluation consumer.

---

## Evaluation model (chosen: Unleash-style)

Per flag + environment:
- **enabled** (master switch — the existing `flag_environments.enabled` toggle), plus
- an ordered list of **strategies**, each a set of **constraints** (`fieldKey` + operator + values),
  AND-ed within the strategy.

Evaluation of `isEnabled(flag, context)`:
1. env `enabled = false` → **off**, `reason: 'disabled'`.
2. env `enabled = true`, **no strategies** → **on** for everyone, `reason: 'default'` (backward
   compatible with today's behavior).
3. env `enabled = true`, **≥1 strategy** → **on** if *any* strategy matches (all its constraints
   pass), `reason: 'strategy-match'`; otherwise **off**, `reason: 'default'`.

OR across strategies, AND within a strategy. Allowlist ("only phyg") = one strategy
`tenant IN [phyg]`. Blocklist ("everyone except phyg") = `tenant NOT_IN [phyg]`.

---

## Design decisions (my recommendations — flag any you want changed)

**D1 — Data model: one table, constraints as JSONB.**
```
targeting_strategies(
  id, flag_id → feature_flags (cascade), environment_id → environments (cascade),
  position int,                 -- stable display order
  constraints jsonb,            -- [{ fieldKey, operator, values: string[] }]
  created_at, updated_at
)
```
Constraints live in JSONB (read/written as a unit). `fieldKey` is text, validated against the
project's registered context fields on write. No `result` column — a matched strategy always means
"on" (this is the Unleash semantic).

**D2 — Constraint operators per field type** (revives the map removed in Phase 1). `values` is an
array; multi-value ops use the whole array, single-value ops use `values[0]`:
`string`: equals, in, startsWith, contains, regex · `enum`: equals, in · `boolean`: is ·
`number`: eq, neq, lt, lte, gt, gte · `version`: eq, gte, lte, satisfies · `date`: before, after.
Plus `in` / `notIn` for allow/block lists. Operator validity checked against the field's registered
`type` on write.

**D3 — Evaluation & wire format.** `client.service.loadFlagState` also loads strategies per
environment. `evaluateOne`/`evaluateAll` run strategies against the parsed context. `reason` widens
to `'disabled' | 'strategy-match' | 'default'` (still `{ name, enabled, reason }` — SDK unchanged).
Re-add `queryToContext` in `client.routes.ts` to parse query params into a context, coercing values
by each field's type (number/boolean/version/date). This is the core logic and gets the heaviest
tests.

**D4 — Cache.** The `flagState` cache entry grows to include strategies. Any strategy write
invalidates the project's `flagState` prefix (same pattern flag CRUD already uses).

**D5 — Admin API (PUT-replace).** Under `requireAdminKey`:
| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/admin/projects/:projectId/flags/:flagKey/environments/:env/strategies` | List ordered strategies |
| PUT | `/admin/projects/:projectId/flags/:flagKey/environments/:env/strategies` | Replace the whole ordered list |

**D6 — Admin UI.** Flag detail → Environments tab: each env card gains a **strategies** editor under
its enable toggle. Add strategy → add constraints (field dropdown from the registry, operator
dropdown from the field's type, values input typed to the field), reorder, save. Copy makes the
model explicit: enabled + no strategies = on for all; strategies = on only when one matches.

**Out of scope (unless you say otherwise):** percentage/gradual rollout, variants (A/B), sticky
bucketing, segments (reusable constraint sets), scheduled strategies, server/computed enrichment,
`inverted`/`caseInsensitive` constraint flags (use `notIn` for negation).

---

## Tasks (commit-sized)

- **3.1** — `targeting_strategies` schema + relations + types; migration; `db:migrate`.
- **3.2** — Constraint validation (operator↔type, fieldKey exists) + service + PUT/GET routes; register; zod unit + integration tests.
- **3.3** — Evaluation wiring: `client.service` loads+evaluates strategies, `queryToContext` with type coercion, `reason` values, cache includes strategies + invalidation; unit + integration tests (operator/constraint semantics get exhaustive coverage).
- **3.4** — Flag-detail strategies editor UI + `strategiesApi` + hook + component tests.
- **3.5** — Checkpoint: lint, typecheck, full suites; manual pass (add strategy → SDK eval returns strategy-match / default).
