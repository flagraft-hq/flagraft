# Strategy variants — design (DRAFT)

Status: approved in conversation on 2026-11-16 and implemented on branch `feat/variants`.
Where the implementation differs from this text, see "Implementation notes" at the end.

## Goal

Let a flag return a named variant with an optional payload, not only on/off, using the same
model as Unleash **strategy variants**: weighted, sticky, attached to a strategy.

Decisions already made:

- Strategy variants only. Unleash's deprecated flag-level variants and their per-variant
  overrides are out of scope.
- Full scope, built in phases: server, SDKs, admin UI, import/export, docs.
- Bucketing is bit-compatible with Unleash, so a user migrated from Unleash keeps their variant.

## Unleash behaviour this copies

Read from `unleash-client-node` `main` on 2026-11-16 (`src/strategy/util.ts`, `src/variant.ts`,
`src/strategy/strategy.ts`, `src/client.ts`, `src/helpers.ts`).

- Hash: `murmurHash3.x86.hash32(`${groupId}:${stickinessValue}`, 86028157)`.
- Target: `(hash % totalWeight) + 1`, where `totalWeight` is the sum of all variant weights.
  If `totalWeight <= 0`, no variant is selected.
- Walk: go through variants in order, skip weight 0, add weight to a counter, pick the first
  variant where `counter >= target`.
- Stickiness comes from the first variant of the strategy.
  - `default`: `userId`, then `sessionId`, then `remoteAddress` (first non-empty), else random.
  - any other value: that context field; missing or empty falls back to random.
  - random value: `String(Math.round(Math.random() * 100000))`, new on every evaluation.
- Group id for strategy variants is the strategy's `groupId` parameter.
- Result when the flag is off, or on but no variant was selected:
  `{ name: 'disabled', enabled: false }`, with `featureEnabled` saying which of the two it was.
- Payload: `{ type: 'string' | 'json' | 'csv' | 'number', value: string }`. `value` is always a
  string.

Not verified, to be settled in phase 1 before anything depends on it:

- That the hand-written murmur3 matches `murmurhash3js` (unsigned 32-bit result). Phase 1 tests
  it against the expected results in Unleash's client-specification
  (`16-strategy-variants.json`, `08-variants.json`). If the vectors cannot be matched, work
  stops and the compatibility claim is dropped or the approach is revisited with the user.

## Differences from Unleash (deliberate)

- **Group id is the flag key.** Flagraft strategies have no `groupId` parameter. Unleash's UI
  defaults `groupId` to the feature name, so this is compatible in the common case. The
  importer warns when an imported strategy has a different `groupId`.
- **`remoteAddress` is only used if the caller sends it as context.** The server does not
  derive it from the request IP.
- **Stickiness is stored once per strategy on every variant**, and the API rejects mixed
  values, instead of silently using the first variant's value.
- **The server fills in `variable` weights.** Unleash's UI does this; here the API does, so API
  callers and the UI get the same numbers.

## 1. Storage

`targeting_strategies` gets one column:

```ts
variants: jsonb('variants').$type<StrategyVariant[]>().notNull().default([])
```

```ts
interface StrategyVariant {
  name: string
  weight: number // integer 0..1000
  weightType: 'variable' | 'fix'
  stickiness: string // 'default' | 'random' | a context key
  payload?: { type: 'string' | 'json' | 'csv' | 'number'; value: string }
}
```

One drizzle migration. Existing rows get `[]`, which evaluates exactly as today.

A separate `strategy_variants` table was considered and rejected: variants are always read and
replaced with their strategy, the same as `constraints`.

## 2. Admin API

`PUT /api/v1/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/strategies`
accepts an optional `variants` array per strategy. `GET` returns it. Omitting it means `[]`, so
existing callers are unaffected.

Input per variant: `name`, `weightType` (default `variable`), `weight` (required for `fix`,
ignored for `variable`), `stickiness` (default `default`), optional `payload`.

Validation (400 `BadRequest` with a specific message):

- `name`: 1–100 characters, unique within the strategy.
- All variants in a strategy have the same `stickiness`.
- `fix` weights are integers 0–1000 and total at most 1000.
- If there are no `variable` variants, `fix` weights must total exactly 1000.
- `payload.type` is one of the four types; `json` must parse; `number` must be a finite number.
- `payload.value` is at most 10,000 characters; at most 20 variants per strategy. Limits live in
  `src/limits.ts`.
- `stickiness` is not checked against registered context fields. Evaluation accepts any context
  key and falls back to random when it is missing, which is Unleash's behaviour.

Weight fill: `remaining = 1000 - sum(fix)`; each `variable` variant gets
`floor(remaining / n)`, and the first `remaining % n` of them get one more. Stored weights
therefore always total 1000.

This logic is a pure function in a new `src/modules/strategies/variant-rules.ts`, returning a
reason string or the normalised variants, so the importer can reuse it without the throw (same
split as `constraint-rules.ts`).

## 3. Evaluation

New file `src/modules/client/variants.ts`:

- `murmur3(key: string, seed: number): number` — x86 32-bit, UTF-8 input, unsigned result.
- `selectVariant(flagKey, variants, context, random?)` — the Unleash algorithm above. `random`
  is injectable for tests.

`evaluateFlag` changes:

- `StrategyDef` gains `variants`.
- The return value gains `variant: { name, enabled, payload? }`.
- Disabled flag, enabled with no strategies, no strategy matched, or matched strategy without
  variants: `{ name: 'disabled', enabled: false }`.
- Matched strategy with variants: the selected variant with `enabled: true`.
- `reason` values do not change.
- `evaluateFlag` needs the flag key for the hash; it is passed in by `evaluateAll` /
  `evaluateOne`.

`loadEnvState` selects the new column. Variants become part of `FlagState`, so they are covered
by the existing state fingerprint and cache invalidation with no further change (strategy
writes already clear the flag-state cache).

Known limit: with random stickiness the response is not a pure function of state and context.
The ETag still is, so a `304` keeps the SDK's previous assignment, and the SDK cache holds an
assignment for its TTL. Random is therefore "random per fetch", not per call. Documented, not
fixed.

## 4. Client API

Additive on both endpoints:

- `GET /client/features` — each item gains `variant`.
- `GET /client/features/:flagKey` — gains `variant`.

```json
{
  "name": "checkout",
  "enabled": true,
  "reason": "strategy-match",
  "variant": { "name": "blue", "enabled": true, "payload": { "type": "string", "value": "#00f" } }
}
```

The Fastify response schemas must list `variant` (and `payload`), otherwise serialisation
strips it.

## 5. SDKs

JS (`packages/sdk-js`):

```ts
interface Variant {
  name: string
  enabled: boolean
  payload?: { type: 'string' | 'json' | 'csv' | 'number'; value: string }
  featureEnabled: boolean
}
getVariant(flagKey: string, context?: EvaluationContext): Promise<Variant>
```

Python (`packages/sdk-python`): `get_variant(flag_key, context=None) -> Variant` with
`feature_enabled`.

Both reuse the request, cache entry, stale fallback, backoff and error handling of `isEnabled` /
`is_enabled`; the cached single-flag result simply carries the variant too. Where `isEnabled`
would return `false` as a fallback, `getVariant` returns
`{ name: 'disabled', enabled: false, featureEnabled: false }`. `Feature` and `EvaluationResult`
gain an optional `variant`. A server that predates variants returns no `variant`; the SDK
treats that as the disabled variant.

Payloads are returned as stored (string value). No parsing helpers.

## 6. Admin UI

`StrategyEditorModal`:

- A "Variants" section under each strategy's constraints, empty by default with an "Add
  variant" button.
- Row: name, weight type toggle (variable / fixed), weight input shown as a percentage with one
  decimal (enabled only for fixed), payload type select, payload value input, remove.
- One stickiness select per strategy: `default`, `random`, and the project's context field
  keys.
- Variable rows show the percentage they will receive, using the same fill rule as the server.
- Server validation errors are shown inline with the existing `FormError`.

`FlagDetailScreen`: each strategy lists its variant names and percentages.

`lib/types.ts` and `lib/api.ts` gain the variant types. Reuse existing primitives (`Select`,
`Button`, `Toggle`, `Badge`); no new primitive unless something recurs.

## 7. Import and export

Native format (`flagraft.export`):

- `NATIVE_VERSION` becomes 2. Strategies carry `variants`.
- Import accepts version 1 and 2. A version 1 file has no variants.
- The bump is needed because the version is a literal precisely so that an older server refuses
  a file it would only half understand; a version 1 file with an extra field would be silently
  stripped by an older server.
- Imported variants go through `variant-rules`. A strategy whose variants are invalid is
  dropped and reported, like a strategy with a rejected constraint. New warning kind:
  `variant-rejected`.

Unleash import:

- Strategy variants on an importable strategy are mapped one to one (name, weight, weightType,
  stickiness, payload).
- Warn (`behaviour-change`) when the strategy's `groupId` differs from the feature name:
  assignment will differ from Unleash.
- Still dropped and reported: flag-level (`featureEnvironments`) variants, and variants on
  strategies that are skipped for other reasons (for example `flexibleRollout` below 100%).
- Weights go through the same `variant-rules` as the API: `fix` weights are kept, `variable`
  weights are recomputed. If the recomputed weights differ from the source, warn
  (`behaviour-change`). A set that fails validation is rejected and reported, not rescaled.

Unleash export: strategies emit their `variants` instead of `[]`.

## 8. Phases

Each phase is test-first and leaves the test suite green.

1. **Server**: murmur3 and selection (unit tests against Unleash spec vectors),
   `variant-rules`, migration, strategies API, evaluation, client API.
2. **SDKs**: JS `getVariant`, Python `get_variant`, SDK contract test.
3. **Admin UI**: editor section, flag detail display.
4. **Transfer**: native v2, Unleash import and export.
5. **Docs**: README (feature list, config/behaviour notes, FAQ wording), `docs/API.md`,
   `docs/ROADMAP.md` (move variants to shipped), both SDK READMEs, a changeset.

## 9. Tests

- `tests/unit/variants.test.ts`: murmur3 vectors, selection against Unleash spec cases, weight
  0 skipped, stickiness resolution order, random fallback with injected random.
- `tests/unit/variant-rules.test.ts`: each validation rule and the weight fill, including
  remainders.
- `tests/unit/evaluate.test.ts`: variant in every evaluation outcome.
- `tests/integration/strategies.test.ts`, `client-strategies.test.ts`: round trip, validation
  errors, variant in both client endpoints, same user gets the same variant.
- `tests/integration/sdk-contract.test.ts`: `getVariant` against a live server.
- SDK unit tests in both packages: result shape, cache reuse, fallback.
- Admin UI tests for the editor section.
- Transfer tests: v1 still imports, v2 round trips, Unleash mapping and warnings.

## Out of scope

- Flag-level variants and per-variant overrides.
- Percentage rollouts (they can reuse `murmur3` later with seed 0 and normalizer 100).
- Variant metrics or impression data.
- Payload parsing helpers in the SDKs.

## Implementation notes

Differences from the design above, decided while building:

- **Hash verified.** `murmur3` and `selectVariant` reproduce 13 expected results from Unleash's
  client-specification (`08-variants.json`, `16-strategy-variants.json`); they are in
  `tests/unit/variants.test.ts`. Input is hashed as UTF-8, which differs from Unleash's Node
  client for non-ASCII stickiness values only.
- **Unleash export uses `flexibleRollout`.** A strategy with variants is exported as a 100%
  `flexibleRollout` with `groupId` set to the flag key, because that is the strategy type that
  carries a group id. Not tested against a running Unleash import.
- **Unleash import reports an unusable variant set as `unsupported-strategy`**, like every
  other strategy the adapter drops. `variant-rejected` is used by the native importer only.
- **Recomputed weights can move users.** Unleash weights such as 1/1 are stored as 500/500.
  The split is the same but the bucket boundaries are not, so the import reports it.
- **Admin UI display** is a text summary on the environment card ("a 50%, b 50%") rather than
  badges, matching the existing one-line strategy summary.
- **Python SDK** has no changeset; only `@flagraft/sdk` is versioned through changesets.
