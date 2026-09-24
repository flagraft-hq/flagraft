# Flagraft API Reference

---

## Auth -- there is no login

There is no session, no JWT, no OAuth. Every request carries an API key directly in the `Authorization` header:

```
Authorization: ff_a1b2c3d4e5f6a7b8c9d0e1f2
```

The very first key (root admin) is created once via CLI, not via any API:

```bash
pnpm admin:create-root-key
# prints: ff_a1b2c3d4e5f6... -- save it, shown only once
```

Everything below uses `ROOT_KEY` as a placeholder for that value.

---

## The Full Flow -- Create and Evaluate a Flag

### Step 1 -- Create a project

```bash
curl -X POST http://localhost:3000/api/v1/admin/projects \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "My App", "slug": "my-app", "description": "optional" }'
```

**Body:**

| Field         | Required | Notes                      |
| ------------- | -------- | -------------------------- |
| `name`        | yes      | Display name               |
| `slug`        | yes      | URL-safe unique identifier |
| `description` | no       |                            |

**Response (201):** Returns the created project with `id`. Also auto-creates `development` and `production` environments behind the scenes.

---

### Step 2 -- Check your environments (auto-created)

```bash
curl http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/environments \
  -H "Authorization: $ROOT_KEY"
```

Returns the project's environments with their `id` and `slug`. You need the `slug` for enable/disable and strategy calls.

---

### Step 3 -- Create a project admin key (optional but recommended)

The root key is a master key. For day-to-day ops, create a project-scoped admin key:

```bash
curl -X POST http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/keys \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "type": "admin", "description": "dev team key" }'
```

**Body:**

| Field           | Required            | Notes                   |
| --------------- | ------------------- | ----------------------- |
| `type`          | yes                 | `"admin"` or `"client"` |
| `environmentId` | only for `"client"` | UUID of the environment |
| `description`   | no                  |                         |

**Response (201):** Contains `key` (plaintext, shown once), `keyPrefix`, `id`.

---

### Step 4 -- Create a feature flag

```bash
curl -X POST http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/flags \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "New Checkout Flow", "key": "new-checkout-flow" }'
```

**Body:**

| Field         | Required | Notes                                                     |
| ------------- | -------- | --------------------------------------------------------- |
| `name`        | yes      | Display name                                              |
| `key`         | yes      | Stable identifier used in code -- cannot be changed later |
| `description` | no       |                                                           |

**Response (201):** Returns the flag. Also auto-creates `flag_environments` rows for all environments, all `enabled: false`.

---

### Step 5 -- Enable the flag in an environment

```bash
curl -X POST \
  "http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/production/enable" \
  -H "Authorization: $ROOT_KEY"
```

To disable:

```bash
curl -X POST \
  "http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/production/disable" \
  -H "Authorization: $ROOT_KEY"
```

No body needed. Uses the flag `key` and environment `slug` in the URL.

---

### Step 6 -- Create a client key for your app

```bash
curl -X POST http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/keys \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "type": "client", "environmentId": "$PRODUCTION_ENV_ID", "description": "production app" }'
```

Client keys are scoped to a specific environment. The key itself carries that scope -- the client never passes project/environment IDs in requests.

---

### Step 7 -- Evaluate flags (client API)

Get all flags at once:

```bash
curl "http://localhost:3000/api/v1/client/features?userId=usr_123" \
  -H "Authorization: $CLIENT_KEY"
```

```json
{
  "features": [
    { "name": "new-checkout-flow", "enabled": true },
    { "name": "dark-mode", "enabled": false }
  ]
}
```

This response carries an `ETag`. Send it back as `If-None-Match` and an unchanged
result costs a `304` with no body instead of the full list:

```bash
curl -i "http://localhost:3000/api/v1/client/features?userId=usr_123" \
  -H "Authorization: $CLIENT_KEY" \
  -H 'If-None-Match: "kP3nQ8..."'
# HTTP/1.1 304 Not Modified
```

The tag covers the flag state and the query context together, so it changes as soon
as either does. The official SDK does this automatically.

Get one flag with reason:

```bash
curl "http://localhost:3000/api/v1/client/features/new-checkout-flow?userId=usr_123" \
  -H "Authorization: $CLIENT_KEY"
```

```json
{ "name": "new-checkout-flow", "enabled": true, "reason": "default" }
```

Every query param becomes evaluation context. `userId`, `companyId`, `plan`, `tenant` -- whatever your app knows about the caller. Only keys registered as context fields are considered; unknown keys are ignored.

`reason` is one of:

- `strategy-match` -- a targeting strategy matched the context
- `default` -- the flag is enabled with no strategies (on for everyone), or enabled but no strategy matched (off)
- `disabled` -- the flag is off in this environment

---

### Bonus -- Target specific callers with a strategy

First register the context field you want to target on:

```bash
curl -X POST http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/context-fields \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "key": "tenant", "type": "string" }'
```

Then set the flag's strategies for an environment. `PUT` replaces the whole ordered list. Each strategy is a set of constraints that AND together; multiple strategies OR together; a matched strategy serves the flag on.

```bash
curl -X PUT \
  "http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/production/strategies" \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "strategies": [ { "constraints": [ { "fieldKey": "tenant", "operator": "in", "values": ["phyg"] } ] } ] }'
```

Now `?tenant=phyg` returns `enabled: true, reason: strategy-match`, while any other tenant (or a missing `tenant`) returns `enabled: false, reason: default`. The flag must be enabled in the environment for strategies to apply -- a disabled environment always returns `reason: disabled`.

**Operators by field type:** `string` -- `equals`, `in`, `notIn`, `startsWith`, `contains`, `regex`; `enum` -- `equals`, `in`, `notIn`; `boolean` -- `is`; `number` -- `eq`, `neq`, `lt`, `lte`, `gt`, `gte`; `version` -- `eq`, `gte`, `lte`, `satisfies`; `date` -- `before`, `after`. Constraints on `enum` fields are validated against the field's allowed values.

A `regex` pattern is checked when it is saved. An invalid pattern, or one that can
backtrack exponentially -- a repeated group that itself repeats, such as `(a+)+$` --
is rejected with a `400`, because evaluation runs the pattern against caller-supplied
context on every request and a pattern like that would hang the server for everyone.
Ordinary patterns are unaffected.

---

## Import and Export

Two separate surfaces that share no endpoint and no request parameter:

- **Native** -- `flagraft.export` v1. Round-trips losslessly. For backups, restores, and
  cloning a project into another project or another install.
- **External tools** -- one route pair per tool. Unleash is the only one today.

There is no `format` parameter and no format sniffing. Each endpoint accepts exactly one
shape, and tells you which route wants the other one.

| Method | Path                                                 | Auth          | What it does                     |
| ------ | ---------------------------------------------------- | ------------- | -------------------------------- |
| `GET`  | `/api/v1/admin/projects/:id/transfer/export`         | admin         | Native export                    |
| `POST` | `/api/v1/admin/projects/:id/transfer/import`         | project admin | Native import                    |
| `GET`  | `/api/v1/admin/projects/:id/transfer/export/unleash` | admin         | Export in Unleash's import shape |
| `POST` | `/api/v1/admin/projects/:id/transfer/import/unleash` | project admin | Import an Unleash export         |

Import needs the owner or admin role, because it rewrites flag state in every
environment including protected ones -- the same rule `DELETE /flags/:key` follows.

### The native document

```json
{
  "format": "flagraft.export",
  "version": 1,
  "exportedAt": "2026-09-12T05:30:00.000Z",
  "project": { "slug": "web", "name": "Web" },
  "contextFields": [
    {
      "key": "plan",
      "type": "enum",
      "description": "Billing plan",
      "enumValues": ["free", "pro", "enterprise"]
    }
  ],
  "flags": [
    {
      "key": "new-checkout",
      "name": "New checkout",
      "description": "Rewritten checkout funnel",
      "environments": {
        "development": {
          "enabled": true,
          "strategies": [
            { "constraints": [{ "fieldKey": "plan", "operator": "in", "values": ["pro"] }] }
          ]
        },
        "production": { "enabled": false, "strategies": [] }
      }
    }
  ]
}
```

Strategy order is array order. `project` and `exportedAt` are informational -- the import
target is always the `projectId` in the URL, so a document exported from `web` imports
into `mobile` with no editing.

**Deliberately absent:** ids (per-install UUIDs, meaningless elsewhere), timestamps and
authors, API keys, users and memberships, pending approval toggles, and project settings.
Importing settings would let a file relax another install's safety rules.

### Export

```
GET /api/v1/admin/projects/:id/transfer/export?keys=a,b,c
```

`keys` is optional and exports a subset. The response is always an envelope:

```json
{ "document": {}, "warnings": [] }
```

Never a bare file. The Unleash export can drop strategies, and a bare download has
nowhere to report that -- so both export routes return one shape. Scripts use
`curl ... | jq .document > flags.json`. The native export never populates `warnings`.

### Import

```
POST /api/v1/admin/projects/:id/transfer/import
```

```jsonc
{
  "document": {
    /* flagraft.export v1 */
  },
  "onConflict": "skip", // "skip" (default) | "overwrite"
  "environmentMap": { "prod": "production" }, // optional
  "dryRun": false,
}
```

- **One transaction.** It all lands or none of it does. A half-imported project is
  impossible rather than recoverable.
- **`dryRun`** runs the identical code path and rolls back, returning the report it would
  have returned. It is not a separate validation pass, so the preview cannot drift from
  the real thing.
- **`onConflict: "skip"`** (default) leaves an existing flag untouched and reports it.
  **`"overwrite"`** replaces the name, description, per-environment `enabled`, and the
  whole strategy list for each environment the document names. Environments the document
  is silent about are left alone -- silence is not an instruction to disable.
- **Environments** match by slug, `environmentMap` first. Unmatched names are reported
  and their state and strategies skipped; the flag itself still imports. Missing
  environments are never created: one needs its own API keys and protection setting.
- **Context fields** are created when missing and never modified when present. Every
  creation is listed in the report.

### Context fields on import

An import creates the context fields the file names and never touches one that already
exists. It is held to exactly the rules `POST /context-fields` enforces, because it writes
to the same table:

- keys must match `^[A-Za-z_][A-Za-z0-9_.-]*$` and be at most 64 characters
- an `enum` field must carry a non-empty `enumValues`, and nothing else may carry one
- a project may hold at most 25 context fields; an import that would take it over is
  refused with a `409` and writes nothing at all

A native document that breaks the first two is rejected with a `400`. An Unleash export is
not: its context names are free-form, so a name that is not a legal key here is dropped and
reported, and the strategies referring to it fail the ordinary unknown-field check and are
reported one by one -- the rest of the migration still lands.

### The fail-safe rule

**If any part of a strategy cannot be represented, the whole strategy is dropped and
reported.**

A strategy is an AND of constraints, so dropping one constraint _widens_ who the flag is
on for -- a strategy scoped to `plan in [enterprise]` that loses its only constraint
becomes match-everybody. This applies identically to unsupported operators, unsupported
Unleash strategy types, and constraints naming a field whose local type rejects the
operator. Import errs narrow, and tells you exactly what to rebuild by hand.

### Protected environments

When the project has `settings.security.requireApprovalInProd`, import **refuses to
change `enabled` in protected environments** and reports those as `approval-required`.
Strategies still import -- they are not behind the approval flow. Import never creates
pending toggle rows: a bulk file is not a considered request by a named admin.

### The report

Both import routes return the same shape. Native imports never produce `unsupported-*`
warnings.

```jsonc
{
  "report": {
    "dryRun": true,
    "source": "unleash", // "flagraft" | "unleash"
    "counts": {
      "flagsCreated": 12,
      "flagsUpdated": 3,
      "flagsSkipped": 1,
      "contextFieldsCreated": 4,
      "strategiesImported": 18,
      "strategiesSkipped": 2,
    },
    "contextFieldsCreated": ["plan", "userId"],
    "unmatchedEnvironments": ["staging"],
    "flags": [
      { "key": "new-checkout", "action": "created", "warnings": [] },
      { "key": "old-banner", "action": "skipped", "reason": "exists (onConflict=skip)" },
      {
        "key": "beta-search",
        "action": "created",
        "warnings": [
          {
            "environment": "production",
            "kind": "unsupported-strategy",
            "detail": "Strategy dropped: flexibleRollout at 50% ...",
          },
        ],
      },
    ],
  },
  "warnings": [],
}
```

`action` is `created | updated | skipped`. `kind` is a closed set:

| `kind`                 | Means                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `unsupported-strategy` | The source used a feature with no equivalent here                |
| `unsupported-operator` | Export only: Unleash has no operator for one of ours             |
| `constraint-rejected`  | A constraint failed validation, so its strategy was dropped      |
| `unknown-environment`  | No local environment matched that name                           |
| `approval-required`    | Protected environment behind the two-admin flow; state untouched |
| `behaviour-change`     | Imported, but matches slightly differently than it did           |

The top-level `warnings` array carries document-level notes from an adapter (archived
features, dropped segments and tags). Per-flag notes live on the flag's own entry.

### Worked example -- clone a project

```bash
# 1. Export from the source project.
curl -s "http://localhost:3000/api/v1/admin/projects/$SRC/transfer/export" \
  -H "Authorization: $ADMIN_KEY" | jq .document > flags.json

# 2. See what it would do to the target project, without writing anything.
curl -s -X POST "http://localhost:3000/api/v1/admin/projects/$DST/transfer/import" \
  -H "Authorization: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d "$(jq -n --slurpfile d flags.json '{ document: $d[0], dryRun: true }')" | jq .report

# 3. Happy with the report? Run it for real.
curl -s -X POST "http://localhost:3000/api/v1/admin/projects/$DST/transfer/import" \
  -H "Authorization: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d "$(jq -n --slurpfile d flags.json '{ document: $d[0] }')" | jq .report
```

---

## Migrating from Unleash

Accepts the document Unleash's `POST /api/admin/features-batch/export` produces (v5 / v6),
which is also what its own importer takes.

```bash
curl -s -X POST "http://localhost:3000/api/v1/admin/projects/$PROJECT_ID/transfer/import/unleash" \
  -H "Authorization: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d "$(jq -n --slurpfile d unleash-export.json '{ document: $d[0], dryRun: true }')" | jq
```

Flagraft's model has no variants, no percentage rollouts and no segments. Unleash leans
on all three, so the mapping is lossy by nature -- and everything lost is reported.

Flagraft is deliberately lenient about the shape: Unleash's export differs between
versions, and entries arrive missing `environment` or `strategyName` (some write `name`
instead). Rather than reject the whole file over a few odd rows, those entries are
skipped and named in the report so the rest of the migration still lands.

### Strategies with no environment

An export taken from a single Unleash environment writes no `environment` on its
strategies at all -- the environment appears only on the feature's `featureEnvironments`
row. Such a strategy is placed in the one environment its flag has, or, if the flag has
no state row, in the single environment the export describes. That is a lookup, not a
guess, and the import reports how many strategies were placed this way and where.

A strategy with no `environment` in an export that describes **several** environments is
genuinely ambiguous, so it is **dropped** and reported. Placing it would switch targeting
on somewhere the export never named.

### Top level

| Unleash                                                 | Becomes                                             |
| ------------------------------------------------------- | --------------------------------------------------- |
| `features[].name`                                       | both `key` and `name` (Unleash has no display name) |
| `features[].description`                                | `description`                                       |
| `features[].archived: true`                             | **skipped**, reported                               |
| `features[].type`, `stale`, `impressionData`, `project` | ignored; no equivalent                              |
| `featureEnvironments[]`                                 | per-environment `enabled`                           |
| `featureStrategies[]`                                   | strategies, ordered by `sortOrder`                  |
| `featureStrategies[].environment` missing               | inferred when unambiguous; see above                |
| `contextFields[]`, `legalValues[].value`                | context fields, `enumValues`                        |
| `featureTags`, `tagTypes`, `segments`, `dependencies`   | **dropped**, reported once each                     |
| any `variants`                                          | **dropped**, reported                               |

### Strategies

| `strategyName`                                    | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `default`                                         | one strategy carrying the mapped constraints                            |
| `flexibleRollout`, `parameters.rollout === "100"` | same as `default`                                                       |
| `flexibleRollout` below 100                       | **skipped** -- importing 50% as always-on would take it to 100%         |
| `userWithId`                                      | constraint `userId in [...]`; the `userId` field is created as `string` |
| `remoteAddress`                                   | **skipped** -- Unleash matches CIDR, our `in` is exact equality         |
| `applicationHostname`                             | **skipped** -- no natural context field to land on                      |
| `gradualRollout*` (legacy)                        | **skipped**                                                             |
| anything else, including custom strategies        | **skipped**                                                             |
| any strategy with `disabled: true`                | **skipped**, reported as intentionally off rather than unsupported      |
| any strategy referencing a `segment`              | **skipped** -- a segment is a named constraint set we cannot store      |

### Constraint operators

| Unleash                               | Becomes               | Needs field type                             |
| ------------------------------------- | --------------------- | -------------------------------------------- |
| `IN`                                  | `in`                  | string, enum                                 |
| `NOT_IN`                              | `notIn`               | string, enum                                 |
| `STR_CONTAINS`                        | `contains`            | string                                       |
| `STR_STARTS_WITH`                     | `startsWith`          | string                                       |
| `NUM_EQ`                              | `eq`                  | number                                       |
| `NUM_GT` `NUM_GTE` `NUM_LT` `NUM_LTE` | `gt` `gte` `lt` `lte` | number                                       |
| `DATE_AFTER` `DATE_BEFORE`            | `after` `before`      | date                                         |
| `SEMVER_EQ`                           | `eq`                  | version                                      |
| `STR_ENDS_WITH`                       | --                    | no equivalent                                |
| `SEMVER_GT` `SEMVER_LT`               | --                    | we have only `eq`, `gte`, `lte`, `satisfies` |
| `inverted: true`                      | the negated operator  | see below                                    |

An unmapped operator drops its whole strategy, per the fail-safe rule above.
`caseInsensitive: true` is kept and reported as `behaviour-change`: the constraint becomes
case-sensitive, which narrows who matches, and narrowing is the safe direction.

#### Inverted constraints

Unleash writes "is not one of" as an operator plus `inverted: true`. There is no NOT
wrapper here, so the inversion is folded into the operator itself, which is exact:

| Unleash, inverted            | Becomes                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `IN`                         | `notIn`                                                                                              |
| `NOT_IN`                     | `in`                                                                                                 |
| `NUM_EQ`                     | `neq`                                                                                                |
| `NUM_GT` / `NUM_GTE`         | `lte` / `lt`                                                                                         |
| `NUM_LT` / `NUM_LTE`         | `gte` / `gt`                                                                                         |
| `STR_CONTAINS`               | **dropped** -- no `notContains`                                                                      |
| `STR_STARTS_WITH`            | **dropped** -- no `notStartsWith`                                                                    |
| `SEMVER_EQ`                  | **dropped** -- version has no `neq`                                                                  |
| `DATE_AFTER` / `DATE_BEFORE` | **dropped** -- `before` and `after` are both strict here, so negating one loses the boundary instant |

### Context field typing

Unleash context fields carry no type; Flagraft gates operators on one. So the type is
inferred from how each field is used across the whole document, most specific first:

1. any `SEMVER_*` operator -> `version`
2. any `DATE_*` operator -> `date`
3. any `NUM_*` operator -> `number`
4. `legalValues` present -> `enum`, with those values
5. otherwise -> `string`

Operator families beat `legalValues`: a field with legal values that is also compared with
`NUM_GT` is being used as a number, and an enum would reject the numeric operator.
Operators we cannot map at all are ignored when deciding -- the strategy using one is
dropped anyway, so it should not drag the field's type with it.

A field used with operators implying two different types becomes a `string` and is
reported as `behaviour-change`; the constraints that then fail validation are dropped by
the ordinary fail-safe rule. A field that already exists locally is never retyped.

### Exporting for Unleash

```
GET /api/v1/admin/projects/:id/transfer/export/unleash
```

Every collection Unleash's importer expects is present, empty where we have nothing.
Each strategy goes out as `strategyName: "default"` with `sortOrder` from its position.

Operators map back, with two that change shape and five that cannot travel:

| Flagraft                            | Becomes                            | Note                                                  |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `in` / `notIn`                      | `IN` / `NOT_IN`                    |                                                       |
| `equals`                            | `IN` with one value                | Unleash has no equality operator                      |
| `is` (boolean)                      | `IN` with `"true"` / `"false"`     | Unleash context values are strings throughout         |
| `contains` / `startsWith`           | `STR_CONTAINS` / `STR_STARTS_WITH` |                                                       |
| `eq` `gt` `gte` `lt` `lte` (number) | `NUM_*`                            |                                                       |
| `before` / `after`                  | `DATE_BEFORE` / `DATE_AFTER`       |                                                       |
| `eq` (version)                      | `SEMVER_EQ`                        |                                                       |
| `gte` / `lte` (version)             | --                                 | Unleash has only the strict `SEMVER_GT` / `SEMVER_LT` |
| `neq`                               | --                                 | no `NUM_NEQ` in Unleash                               |
| `satisfies`                         | --                                 | no semver-range operator                              |
| `regex`                             | --                                 | no regex operator                                     |

A strategy using one of the unmappable operators is omitted and named in `warnings` --
which is why export returns an envelope rather than a bare document.

---

## All Endpoints at a Glance

| Method   | Path                                                                     | Auth   | What it does                                    |
| -------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------- |
| `POST`   | `/api/v1/admin/projects`                                                 | root   | Create project (auto-creates 2 envs)            |
| `GET`    | `/api/v1/admin/projects`                                                 | admin  | List projects                                   |
| `GET`    | `/api/v1/admin/projects/:id`                                             | admin  | Get project                                     |
| `PATCH`  | `/api/v1/admin/projects/:id`                                             | admin  | Update name / slug / description                |
| `DELETE` | `/api/v1/admin/projects/:id`                                             | root   | Delete project and all children                 |
| `POST`   | `/api/v1/admin/projects/:id/environments`                                | admin  | Create environment                              |
| `GET`    | `/api/v1/admin/projects/:id/environments`                                | admin  | List environments                               |
| `DELETE` | `/api/v1/admin/projects/:id/environments/:envId`                         | admin  | Delete environment                              |
| `POST`   | `/api/v1/admin/projects/:id/flags`                                       | admin  | Create flag (auto-creates flag_environments)    |
| `GET`    | `/api/v1/admin/projects/:id/flags`                                       | admin  | List flags                                      |
| `GET`    | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Get flag                                        |
| `PATCH`  | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Update name / description                       |
| `DELETE` | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Delete flag                                     |
| `POST`   | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/enable`     | admin  | Enable flag in environment                      |
| `POST`   | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/disable`    | admin  | Disable flag in environment                     |
| `GET`    | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/strategies` | admin  | List targeting strategies                       |
| `PUT`    | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/strategies` | admin  | Replace targeting strategies (ordered list)     |
| `GET`    | `/api/v1/admin/projects/:id/transfer/export`                             | admin  | Export flags as a flagraft.export document      |
| `POST`   | `/api/v1/admin/projects/:id/transfer/import`                             | admin  | Import a flagraft.export document (owner/admin) |
| `GET`    | `/api/v1/admin/projects/:id/transfer/export/unleash`                     | admin  | Export in Unleash's import shape                |
| `POST`   | `/api/v1/admin/projects/:id/transfer/import/unleash`                     | admin  | Import an Unleash export (owner/admin)          |
| `GET`    | `/api/v1/admin/projects/:id/context-fields`                              | admin  | List context fields                             |
| `POST`   | `/api/v1/admin/projects/:id/context-fields`                              | admin  | Create context field                            |
| `PATCH`  | `/api/v1/admin/projects/:id/context-fields/:fieldId`                     | admin  | Update context field (key is immutable)         |
| `DELETE` | `/api/v1/admin/projects/:id/context-fields/:fieldId`                     | admin  | Delete context field                            |
| `POST`   | `/api/v1/admin/projects/:id/keys`                                        | admin  | Create API key (plaintext returned once)        |
| `GET`    | `/api/v1/admin/projects/:id/keys`                                        | admin  | List keys (prefix only, no plaintext)           |
| `DELETE` | `/api/v1/admin/projects/:id/keys/:keyId`                                 | admin  | Revoke key                                      |
| `GET`    | `/api/v1/client/features`                                                | client | Evaluate all flags (ETag / `If-None-Match`)     |
| `GET`    | `/api/v1/client/features/:flagKey`                                       | client | Evaluate one flag with reason                   |

---

## Key Tiers

| Tier          | Created by            | Can do                                                   |
| ------------- | --------------------- | -------------------------------------------------------- |
| Root admin    | CLI only              | Everything, including create and delete projects         |
| Project admin | Root via API          | Full CRUD within the scoped project, cannot touch others |
| Client        | Root or admin via API | Read-only flag evaluation for its scoped project + env   |
