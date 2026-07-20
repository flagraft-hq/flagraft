# Remove Overrides + Context Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two phases, strictly in order:

1. **Phase 1 — Remove overrides.** Delete the context-override feature end to end: DB table, backend module, evaluation logic, admin UI, tests, docs. Evaluation becomes "return the environment default."
2. **Phase 2 — Context fields.** Per-project registry of context fields (the attributes the SDK sends with evaluations) with CRUD API and a Settings screen section, per the prototype in `flagraft-design/project/screens-settings.jsx` (lines 372–770).

**Scope decisions (confirmed with user 2026-07-17):**

1. Overrides are removed entirely — no deprecation period, no data migration of existing override rows (the table is dropped).
2. Context fields are **registry + UI only**. `source` (`sdk` / `server` / `computed`) is stored and displayed but there is no enrichment engine.
3. With overrides gone, context fields have **no evaluation-time consumer**: they are a documented schema of what the SDK sends, and the foundation for future targeting. Consequently Phase 2 drops everything override-dependent from the earlier draft: no `usedIn` counts, no delete guard, no override-form integration.
4. **Client API stays wire-compatible** where cheap: `GET /client/features/:flagKey` keeps its `{ name, enabled, reason }` shape with `reason` always `'default'`, so `packages/sdk-js` needs no changes. The SDK keeps accepting an `EvaluationContext` (sent as query params, ignored by the server) — that becomes meaningful again when targeting returns.

**Out of scope:** any replacement targeting mechanism, enrichment, strict key enforcement, `Export JSON Schema`, reserved fields (`_env`, `_flag`, `_now`).

**Repo rules:** No `git add`/`commit`/`push` at any point — the user commits. Always write tests. Run `pnpm db:migrate` after schema changes. Integration test notes: `truncateAll` skips `users`; 2 integration tests fail by design (boot seeding).

---

# Phase 1 — Remove overrides

## Backend

- **`src/db/schema.ts`**: delete `flagOverrides` table, `flagOverridesRelations`, the `overrides: many(flagOverrides)` entries in `environmentRelations` / `featureFlagRelations`, and the `FlagOverride` / `NewFlagOverride` types. Generate + run a migration that drops `flag_overrides`.
- **`src/modules/flags/`**: delete `override.routes.ts`, `override.service.ts`, `override.schema.ts`; remove the `overrideRoutes` registration from `src/server.ts`.
- **`src/modules/flags/flag.service.ts`**: remove the `overrideCounts` query (~lines 83–103); flag env state no longer reports an `overrides` count — drop it from the response shape.
- **`src/evaluation/engine.ts`**: delete the file. `FlagEnvironmentState` collapses to `{ enabled: boolean }`, which `client.service.ts` can own directly.
- **`src/modules/client/client.service.ts`**: drop the overrides query and `evaluateFlag` usage. `loadFlagState` returns `Record<string, { enabled: boolean }>`; `evaluateAll` maps it; `evaluateOne` returns `{ name, enabled, reason: 'default' }` (404 unchanged). Keep the unused-context parameter out entirely — `queryToContext` in `client.routes.ts` goes too; the server simply ignores query params.
- **Cache**: keys and flow unchanged. Old cached `flagState` entries carry a now-unread `overrides` array until natural expiry — harmless, no flush step needed.
- **`docs/API.md`**: remove the override endpoints and update the client evaluation description.

## Backend tests

- Delete `tests/integration/overrides.test.ts` and `tests/evaluation/engine.test.ts`.
- Update `tests/integration/client.test.ts`, `cache.test.ts`, `phase1.test.ts` — remove override setup/assertions; single-flag responses assert `reason: 'default'`.
- `tests/helpers/db.ts`: remove `flag_overrides` from `truncateAll`.

## Admin UI

**Delete (components + their tests):** `ContextOverridesSection.tsx`, `OverrideForm.tsx`, `OverrideRow.tsx`, `OverridesEmptyState.tsx`, `hooks/useOverrides.ts`, `styles/overrides.css` (drop its import from `styles/index.css`).

**Delete (lib):** `overridesApi` in `lib/api.ts`; `Override` type and `OPS_BY_TYPE` in `lib/types.ts`; `isDuplicate` / `validateOverrideForm` / `OverrideValidationErrors` in `lib/validation.ts` + their tests. `FlagEnvState` loses `overrides` (becomes `{ on: boolean }`).

**Keep for Phase 2:** `ContextField` type, `contextFieldsApi`, `hooks/useContextFields.ts`.

**Edit:**

- `FlagDetailScreen.tsx`: remove the ContextOverridesSection render + anchor + `scrollToOverrides`, per-env override count copy and "Manage overrides" button, `totalOverrides` header stat, and the tab count; tab label becomes "Environments".
- `FlagRow.tsx` / `StatePill.tsx`: drop the `overrides` prop and count chip.
- `FilterBar.tsx` / `FlagsScreen.tsx`: remove the "has overrides" filter option and its predicate case.
- `SideNav.tsx` / `App.tsx`: remove the "Overrides" nav item, its type member, and the `/overrides` placeholder route.
- `EnvironmentsScreen.tsx`: reword the two copy strings that mention overrides.
- `GlobalSearch.tsx`: update the stale `ponytail:` comment about adding overrides as a search source.
- Update affected tests (`FlagDetailScreen`, `FlagRow`, `StatePill`, `FilterBar`, `FlagsScreen`, `SideNav`, `App.routing`, `api`, `validation`, layout tests referencing the nav item).
- Check `e2e/` for override flows and remove them.

## Phase 1 tasks

### Task 1.1 — Backend removal

- [ ] Schema + migration (drop `flag_overrides`); `pnpm db:generate` && `pnpm db:migrate`
- [ ] Delete override module files; unregister routes; simplify `flag.service.ts`, `client.service.ts`, `client.routes.ts`; delete `evaluation/engine.ts`
- [ ] Update/delete backend tests per above; suite green (modulo 2 known boot-seeding failures)
- [ ] Update `docs/API.md`

### Task 1.2 — Admin UI removal

- [ ] Delete override components, hook, styles, api/types/validation code + tests
- [ ] Edit FlagDetailScreen, FlagRow, StatePill, FilterBar, FlagsScreen, SideNav, App, EnvironmentsScreen copy
- [ ] Remove override e2e flows; admin-ui suite green

### Task 1.3 — Checkpoint

- [ ] `pnpm lint`, `pnpm typecheck`, full test suites (root + admin-ui + sdk-js)
- [ ] Manual pass: flag detail renders without overrides section; client `GET /client/features/:key` returns `reason: 'default'`; SDK smoke works unchanged
- [ ] Stop and report — user reviews and commits before Phase 2

---

# Phase 2 — Context fields

The admin UI already has the read path: `contextFieldsApi.list` (`lib/api.ts:119`) calls `GET /api/v1/admin/projects/:projectId/context-fields`, which doesn't exist yet. Phase 2 builds the backend and the Settings management UI.

## Data model

New table in `src/db/schema.ts`, following existing column helpers and naming:

```ts
export const contextFields = pgTable(
  'context_fields',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    type: text('type').notNull().default('string'),
    source: text('source').notNull().default('sdk'),
    required: boolean('required').notNull().default(false),
    description: text('description'),
    example: text('example'),
    enumValues: text('enum_values').array(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('context_fields_project_id_key_unique').on(table.projectId, table.key),
    check(
      'context_fields_type_check',
      sql`"type" IN ('string','enum','boolean','number','version','date')`,
    ),
    check('context_fields_source_check', sql`"source" IN ('sdk','server','computed')`),
  ],
)
```

Plus `contextFieldRelations` (one project), `projectRelations.contextFields: many(...)`, inferred types, migration.

## API

New module `src/modules/context-fields/` mirroring the flags module layout (schema / service / routes), all under `preHandler: fastify.requireAdminKey`, registered in `src/server.ts`:

| Method | Path                                                 | Behavior                       |
| ------ | ---------------------------------------------------- | ------------------------------ |
| GET    | `/admin/projects/:projectId/context-fields`          | List, ordered by key           |
| POST   | `/admin/projects/:projectId/context-fields`          | Create; 409 on duplicate key   |
| PATCH  | `/admin/projects/:projectId/context-fields/:fieldId` | Update everything except `key` |
| DELETE | `/admin/projects/:projectId/context-fields/:fieldId` | 204                            |

Key is immutable after creation — it's the identifier future targeting rules will reference; delete + recreate covers renames. No `usedIn`, no delete guard (nothing references fields anymore). No cache involvement.

Zod input schema:

- `key`: `/^[A-Za-z_][A-Za-z0-9_.-]*$/`, 1–64 chars
- `type`: enum of the 6 types; `source`: enum of the 3 sources (default `'sdk'`)
- `required`: boolean default false; `description` / `example`: optional strings
- `enumValues`: required non-empty string array **iff** `type === 'enum'`, otherwise absent (refine)

Response: `{ id, key, type, source, required, description, example, enumValues }` (nullable description/example/enumValues).

## Admin UI

1. **`lib/types.ts`**: update `ContextField` to the API shape — add `id`, rename `desc` → `description` (nullable), `example` nullable, drop `usedIn`.
2. **`lib/api.ts`**: add `create` / `update` / `delete` to `contextFieldsApi`.
3. **`hooks/useContextFields.ts`**: add `refetch()` for post-mutation refresh.
4. **`ContextFieldsSection.tsx`** (new), rendered in `SettingsScreen` between Environments and Danger Zone. Per prototype: intro blurb, table with Key (+ `required` badge + description), Type (badge + first 3 enum chips), Source, Example, Edit / Delete row actions (no "Used in" column). "Add field" opens the dialog. Loading / error / empty states inline (project rule: visible success/failure feedback inline, not only toasts).
5. **`ContextFieldDialog.tsx`** (new): add/edit modal on the existing `Modal` primitive — Key (disabled in edit mode), Type select, Description, Source segmented control, Required toggle, Allowed values comma-separated input shown only for `enum`, Example. Client-side validation mirrors the zod rules; API errors (409 duplicate) surface inline.

## Testing

- **Backend unit**: zod cases — key regex accept/reject, enum requires `enumValues`, non-enum rejects `enumValues`.
- **Backend integration**: CRUD happy path; duplicate key → 409; PATCH cannot change `key`; cross-project isolation (same key in two projects OK, list scoped).
- **Admin UI**: section renders fields from mocked API; add flow opens dialog, submits, refetches; enum values input appears only for enum type; inline error on 409; delete confirm flow.

## Phase 2 tasks

### Task 2.1 — Schema + migration

- [ ] Add `contextFields` table, relations, types; `pnpm db:generate` && `pnpm db:migrate`

### Task 2.2 — Backend module

- [ ] `context-field.schema.ts`, `context-field.service.ts`, `context-field.routes.ts`; register in `src/server.ts`
- [ ] Zod unit tests + integration tests per Testing section; suite green

### Task 2.3 — UI plumbing

- [ ] Update `ContextField` type; add mutations to `contextFieldsApi`; add `refetch` to `useContextFields`

### Task 2.4 — Settings UI

- [ ] `ContextFieldsSection.tsx` wired into `SettingsScreen`; `ContextFieldDialog.tsx` add/edit
- [ ] Component tests per Testing section

### Task 2.5 — Verification checkpoint

- [ ] `pnpm lint`, `pnpm typecheck`, full test suites (root + admin-ui)
- [ ] Manual pass: create / edit / delete field in Settings; enum chips render; duplicate key shows inline error
- [ ] Stop and report — user handles commits
