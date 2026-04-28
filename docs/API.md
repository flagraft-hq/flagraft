# Veltra API Reference

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
curl -X POST http://localhost:3000/api/admin/projects \
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

**Response (201):** Returns the created project with `id`. Also auto-creates `development`, `staging`, `production` environments behind the scenes.

---

### Step 2 -- Check your environments (auto-created)

```bash
curl http://localhost:3000/api/admin/projects/$PROJECT_ID/environments \
  -H "Authorization: $ROOT_KEY"
```

Returns `development`, `staging`, `production` with their `id` and `slug`. You need the `slug` for enable/disable and override calls.

---

### Step 3 -- Create a project admin key (optional but recommended)

The root key is a master key. For day-to-day ops, create a project-scoped admin key:

```bash
curl -X POST http://localhost:3000/api/admin/projects/$PROJECT_ID/keys \
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
curl -X POST http://localhost:3000/api/admin/projects/$PROJECT_ID/flags \
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
  "http://localhost:3000/api/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/staging/enable" \
  -H "Authorization: $ROOT_KEY"
```

To disable:

```bash
curl -X POST \
  "http://localhost:3000/api/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/staging/disable" \
  -H "Authorization: $ROOT_KEY"
```

No body needed. Uses the flag `key` and environment `slug` in the URL.

---

### Step 6 -- Create a client key for your app

```bash
curl -X POST http://localhost:3000/api/admin/projects/$PROJECT_ID/keys \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "type": "client", "environmentId": "$STAGING_ENV_ID", "description": "staging app" }'
```

Client keys are scoped to a specific environment. The key itself carries that scope -- the client never passes project/environment IDs in requests.

---

### Step 7 -- Evaluate flags (client API)

Get all flags at once:

```bash
curl "http://localhost:3000/api/client/features?userId=usr_123" \
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
curl "http://localhost:3000/api/client/features/new-checkout-flow?userId=usr_123" \
  -H "Authorization: $CLIENT_KEY"
```

```json
{ "name": "new-checkout-flow", "enabled": true, "reason": "default" }
```

Every query param becomes evaluation context. `userId`, `companyId`, `plan` -- whatever your app knows about the caller.

---

### Bonus -- Add an override for a specific user

```bash
curl -X POST \
  "http://localhost:3000/api/admin/projects/$PROJECT_ID/flags/new-checkout-flow/environments/staging/overrides" \
  -H "Authorization: $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "contextKey": "userId", "contextValue": "usr_ceo", "enabled": false }'
```

Now `?userId=usr_ceo` returns `enabled: false, reason: override` even though staging has the flag on.

---

## All Endpoints at a Glance

| Method   | Path                                                                       | Auth   | What it does                                  |
| -------- | -------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| `POST`   | `/api/admin/projects`                                                      | root   | Create project (auto-creates 3 envs)          |
| `GET`    | `/api/admin/projects`                                                      | admin  | List projects                                 |
| `GET`    | `/api/admin/projects/:id`                                                  | admin  | Get project                                   |
| `PATCH`  | `/api/admin/projects/:id`                                                  | admin  | Update name / slug / description              |
| `DELETE` | `/api/admin/projects/:id`                                                  | root   | Delete project and all children               |
| `POST`   | `/api/admin/projects/:id/environments`                                     | admin  | Create environment                            |
| `GET`    | `/api/admin/projects/:id/environments`                                     | admin  | List environments                             |
| `DELETE` | `/api/admin/projects/:id/environments/:envId`                              | admin  | Delete environment                            |
| `POST`   | `/api/admin/projects/:id/flags`                                            | admin  | Create flag (auto-creates flag_environments)  |
| `GET`    | `/api/admin/projects/:id/flags`                                            | admin  | List flags                                    |
| `GET`    | `/api/admin/projects/:id/flags/:key`                                       | admin  | Get flag                                      |
| `PATCH`  | `/api/admin/projects/:id/flags/:key`                                       | admin  | Update name / description                     |
| `DELETE` | `/api/admin/projects/:id/flags/:key`                                       | admin  | Delete flag                                   |
| `POST`   | `/api/admin/projects/:id/flags/:key/environments/:envSlug/enable`          | admin  | Enable flag in environment                    |
| `POST`   | `/api/admin/projects/:id/flags/:key/environments/:envSlug/disable`         | admin  | Disable flag in environment                   |
| `POST`   | `/api/admin/projects/:id/flags/:key/environments/:envSlug/overrides`       | admin  | Create override                               |
| `GET`    | `/api/admin/projects/:id/flags/:key/environments/:envSlug/overrides`       | admin  | List overrides                                |
| `DELETE` | `/api/admin/projects/:id/flags/:key/environments/:envSlug/overrides/:ovId` | admin  | Delete override                               |
| `POST`   | `/api/admin/projects/:id/keys`                                             | admin  | Create API key (plaintext returned once)      |
| `GET`    | `/api/admin/projects/:id/keys`                                             | admin  | List keys (prefix only, no plaintext)         |
| `DELETE` | `/api/admin/projects/:id/keys/:keyId`                                      | admin  | Revoke key                                    |
| `GET`    | `/api/client/features`                                                     | client | Evaluate all flags for the scoped environment |
| `GET`    | `/api/client/features/:flagKey`                                            | client | Evaluate one flag with reason                 |

---

## Key Tiers

| Tier          | Created by            | Can do                                                   |
| ------------- | --------------------- | -------------------------------------------------------- |
| Root admin    | CLI only              | Everything, including create and delete projects         |
| Project admin | Root via API          | Full CRUD within the scoped project, cannot touch others |
| Client        | Root or admin via API | Read-only flag evaluation for its scoped project + env   |
