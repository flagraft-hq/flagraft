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

---

## All Endpoints at a Glance

| Method   | Path                                                                     | Auth   | What it does                                  |
| -------- | ------------------------------------------------------------------------ | ------ | --------------------------------------------- |
| `POST`   | `/api/v1/admin/projects`                                                 | root   | Create project (auto-creates 2 envs)          |
| `GET`    | `/api/v1/admin/projects`                                                 | admin  | List projects                                 |
| `GET`    | `/api/v1/admin/projects/:id`                                             | admin  | Get project                                   |
| `PATCH`  | `/api/v1/admin/projects/:id`                                             | admin  | Update name / slug / description              |
| `DELETE` | `/api/v1/admin/projects/:id`                                             | root   | Delete project and all children               |
| `POST`   | `/api/v1/admin/projects/:id/environments`                                | admin  | Create environment                            |
| `GET`    | `/api/v1/admin/projects/:id/environments`                                | admin  | List environments                             |
| `DELETE` | `/api/v1/admin/projects/:id/environments/:envId`                         | admin  | Delete environment                            |
| `POST`   | `/api/v1/admin/projects/:id/flags`                                       | admin  | Create flag (auto-creates flag_environments)  |
| `GET`    | `/api/v1/admin/projects/:id/flags`                                       | admin  | List flags                                    |
| `GET`    | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Get flag                                      |
| `PATCH`  | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Update name / description                     |
| `DELETE` | `/api/v1/admin/projects/:id/flags/:key`                                  | admin  | Delete flag                                   |
| `POST`   | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/enable`     | admin  | Enable flag in environment                    |
| `POST`   | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/disable`    | admin  | Disable flag in environment                   |
| `GET`    | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/strategies` | admin  | List targeting strategies                     |
| `PUT`    | `/api/v1/admin/projects/:id/flags/:key/environments/:envSlug/strategies` | admin  | Replace targeting strategies (ordered list)   |
| `GET`    | `/api/v1/admin/projects/:id/context-fields`                              | admin  | List context fields                           |
| `POST`   | `/api/v1/admin/projects/:id/context-fields`                              | admin  | Create context field                          |
| `PATCH`  | `/api/v1/admin/projects/:id/context-fields/:fieldId`                     | admin  | Update context field (key is immutable)       |
| `DELETE` | `/api/v1/admin/projects/:id/context-fields/:fieldId`                     | admin  | Delete context field                          |
| `POST`   | `/api/v1/admin/projects/:id/keys`                                        | admin  | Create API key (plaintext returned once)      |
| `GET`    | `/api/v1/admin/projects/:id/keys`                                        | admin  | List keys (prefix only, no plaintext)         |
| `DELETE` | `/api/v1/admin/projects/:id/keys/:keyId`                                 | admin  | Revoke key                                    |
| `GET`    | `/api/v1/client/features`                                                | client | Evaluate all flags for the scoped environment |
| `GET`    | `/api/v1/client/features/:flagKey`                                       | client | Evaluate one flag with reason                 |

---

## Key Tiers

| Tier          | Created by            | Can do                                                   |
| ------------- | --------------------- | -------------------------------------------------------- |
| Root admin    | CLI only              | Everything, including create and delete projects         |
| Project admin | Root via API          | Full CRUD within the scoped project, cannot touch others |
| Client        | Root or admin via API | Read-only flag evaluation for its scoped project + env   |
