import type { ConstraintLike } from '../../strategies/constraint-rules.js'
import {
  NATIVE_FORMAT,
  NATIVE_VERSION,
  type NativeDocument,
  type TransferWarning,
} from '../transfer.schema.js'
import {
  unleashDocumentSchema,
  type UnleashConstraint,
  type UnleashDocument,
  type UnleashStrategy,
} from './unleash.schema.js'

/**
 * Unleash constraint operators that have a Flagraft equivalent.
 *
 * The ones missing here are missing on purpose:
 *   STR_ENDS_WITH -- no endsWith operator in the model
 *   SEMVER_GT / SEMVER_LT -- we have only eq, gte, lte and satisfies
 * A constraint using one of those drops its whole strategy rather than being
 * approximated, because every approximation here widens who a flag is on for.
 */
export const FROM_UNLEASH_OPERATOR: Record<string, string | undefined> = {
  IN: 'in',
  NOT_IN: 'notIn',
  STR_CONTAINS: 'contains',
  STR_STARTS_WITH: 'startsWith',
  NUM_EQ: 'eq',
  NUM_GT: 'gt',
  NUM_GTE: 'gte',
  NUM_LT: 'lt',
  NUM_LTE: 'lte',
  DATE_AFTER: 'after',
  DATE_BEFORE: 'before',
  SEMVER_EQ: 'eq',
}

/**
 * What an Unleash constraint means when `inverted: true` is set: the negation
 * of the operator, for the ones we can negate exactly.
 *
 * The ones missing here are missing on purpose, because their negation is not
 * a thing we can store:
 *   STR_CONTAINS / STR_STARTS_WITH -- there is no notContains or notStartsWith
 *   SEMVER_EQ -- version fields have no neq
 *   DATE_AFTER / DATE_BEFORE -- before and after are both strict here, so
 *     negating one loses the boundary instant and silently changes who matches
 *     at exactly that time
 * An inverted constraint using one of those drops its whole strategy, the same
 * as any other rule we cannot carry over exactly.
 */
export const INVERTED_FROM_UNLEASH_OPERATOR: Record<string, string | undefined> = {
  IN: 'notIn',
  NOT_IN: 'in',
  NUM_EQ: 'neq',
  NUM_GT: 'lte',
  NUM_GTE: 'lt',
  NUM_LT: 'gte',
  NUM_LTE: 'gt',
}

/**
 * The reverse table. `singleValue` marks an operator Unleash expresses as a
 * one-element IN: it has no equality operator of its own, and its context
 * values are strings throughout, so a boolean `is` lands there too.
 *
 * Number and version share the operator names eq, gt, lt, gte and lte, so the
 * Unleash name depends on the field type -- see toUnleashConstraint.
 */
export const TO_UNLEASH_OPERATOR: Record<
  string,
  { operator: string; singleValue?: boolean } | undefined
> = {
  in: { operator: 'IN' },
  notIn: { operator: 'NOT_IN' },
  equals: { operator: 'IN', singleValue: true },
  is: { operator: 'IN', singleValue: true },
  contains: { operator: 'STR_CONTAINS' },
  startsWith: { operator: 'STR_STARTS_WITH' },
  eq: { operator: 'NUM_EQ' },
  gt: { operator: 'NUM_GT' },
  gte: { operator: 'NUM_GTE' },
  lt: { operator: 'NUM_LT' },
  lte: { operator: 'NUM_LTE' },
  after: { operator: 'DATE_AFTER' },
  before: { operator: 'DATE_BEFORE' },
}

/**
 * Operators Unleash has no equivalent for, listed so the completeness test
 * fails when a new operator joins the model and nobody decides what it means
 * for Unleash.
 */
export const UNREPRESENTABLE_IN_UNLEASH = new Set(['regex', 'neq', 'satisfies'])

/** Version fields override the shared numeric operator names. */
const VERSION_OPERATOR: Record<string, string | undefined> = {
  eq: 'SEMVER_EQ',
  /** Unleash has only the strict SEMVER_GT / SEMVER_LT, so no inclusive bound. */
  gte: undefined,
  lte: undefined,
  satisfies: undefined,
}

export interface UnleashConstraintOut {
  contextName: string
  operator: string
  values: string[]
  caseInsensitive: false
  inverted: false
}

/**
 * Converts one Flagraft constraint to Unleash's shape, or returns null when
 * Unleash cannot express it. A null drops the whole strategy at the caller.
 */
export function toUnleashConstraint(
  constraint: ConstraintLike,
  fieldType: string,
): UnleashConstraintOut | null {
  const mapped = TO_UNLEASH_OPERATOR[constraint.operator]
  if (!mapped) return null

  let operator = mapped.operator
  if (fieldType === 'version') {
    const versionOperator = VERSION_OPERATOR[constraint.operator]
    if (!versionOperator) return null
    operator = versionOperator
  }

  return {
    contextName: constraint.fieldKey,
    operator,
    values: mapped.singleValue ? constraint.values.slice(0, 1) : constraint.values,
    caseInsensitive: false,
    inverted: false,
  }
}

/* ── Context field typing ────────────────────────────────────────────────── */

export interface InferredField {
  key: string
  type: 'string' | 'enum' | 'number' | 'version' | 'date'
  enumValues: string[] | null
  description: string | null
  /** Used with operators implying two different types; fell back to string. */
  conflicted: boolean
}

/** Which Flagraft type each Unleash operator family implies. */
const OPERATOR_FAMILY: Record<string, InferredField['type'] | undefined> = {
  SEMVER_EQ: 'version',
  SEMVER_GT: 'version',
  SEMVER_LT: 'version',
  DATE_AFTER: 'date',
  DATE_BEFORE: 'date',
  NUM_EQ: 'number',
  NUM_GT: 'number',
  NUM_GTE: 'number',
  NUM_LT: 'number',
  NUM_LTE: 'number',
}

/**
 * Works out a Flagraft type for every Unleash context field.
 *
 * Unleash fields carry no type at all, but our operators are gated on one, so
 * the type is read back out of how each field is actually used across the
 * whole document. Operator families win over `legalValues`: a field with legal
 * values that is also compared with NUM_GT is being used as a number, and an
 * enum would reject the numeric operator.
 *
 * A field used with operators implying two different types cannot be both, so
 * it becomes a string and is marked conflicted. The constraints that then fail
 * validation are dropped by the ordinary fail-safe rule, with no special case
 * needed here.
 *
 * Operators we cannot map at all are ignored when deciding: the strategy using
 * one is dropped anyway, so it should not drag the field's type with it.
 */
export function inferFieldTypes(
  fields: { name: string; description?: string | null; legalValues: { value: string }[] }[],
  constraints: { contextName: string; operator: string }[],
): Map<string, InferredField> {
  const families = new Map<string, Set<InferredField['type']>>()
  for (const constraint of constraints) {
    if (!(constraint.operator in FROM_UNLEASH_OPERATOR)) continue
    const family = OPERATOR_FAMILY[constraint.operator]
    if (!family) continue
    const seen = families.get(constraint.contextName) ?? new Set<InferredField['type']>()
    seen.add(family)
    families.set(constraint.contextName, seen)
  }

  const names = new Set<string>([
    ...fields.map((field) => field.name),
    ...constraints.map((constraint) => constraint.contextName),
  ])
  const declared = new Map(fields.map((field) => [field.name, field]))

  const result = new Map<string, InferredField>()
  for (const name of names) {
    const field = declared.get(name)
    const seen = families.get(name)
    const conflicted = (seen?.size ?? 0) > 1
    const family = conflicted ? undefined : [...(seen ?? [])][0]
    const legalValues = field?.legalValues.map((entry) => entry.value) ?? []

    let type: InferredField['type'] = 'string'
    if (family) {
      type = family
    } else if (legalValues.length > 0) {
      type = 'enum'
    }

    result.set(name, {
      key: name,
      type,
      enumValues: type === 'enum' ? legalValues : null,
      description: field?.description ?? null,
      conflicted,
    })
  }

  return result
}

/* ── Unleash document -> native document ─────────────────────────────────── */

export interface ToNativeResult {
  document: NativeDocument
  /** Document-level notes: archived features, dropped segments, tags, variants. */
  warnings: TransferWarning[]
  /** Per-flag notes, keyed by flag key, merged into the import report. */
  flagWarnings: Map<string, TransferWarning[]>
}

/** Context field userWithId lands on. Created as a plain string field. */
const USER_ID_FIELD = 'userId'

/**
 * Decides what one Unleash strategy becomes.
 *
 * Returns the constraints to carry over, or a reason the whole strategy is
 * dropped. Nothing in here approximates: every Unleash feature we cannot store
 * would, if guessed at, widen who the flag is on for.
 */
function convertStrategy(
  strategy: UnleashStrategy,
  operatorFor: (constraint: UnleashConstraint) => string | null,
): { constraints: ConstraintLike[]; caseInsensitive: string[] } | { skip: string } {
  const strategyName = strategy.strategyName ?? strategy.name
  if (!strategyName) {
    /**
     * Without a name there is no way to know what the strategy did, and
     * treating it as `default` would turn an unknown rule into one that
     * matches everybody.
     */
    return { skip: 'the export gives this strategy no name, so what it matched is unknown' }
  }
  if (strategy.disabled) {
    return { skip: `"${strategyName}" is disabled in Unleash, so it was not imported` }
  }
  if (strategy.segments.length > 0) {
    return { skip: `"${strategyName}" uses a segment, which has no equivalent here` }
  }

  const constraints: ConstraintLike[] = []
  /**
   * Matching here is always case-sensitive, so an Unleash constraint that
   * ignored case now matches fewer callers. That narrows rather than widens,
   * which is the safe direction, but it is still a change in who sees the
   * flag -- so it is carried out and reported, not silently applied.
   */
  const caseInsensitive: string[] = []
  for (const constraint of strategy.constraints) {
    if (constraint.caseInsensitive) caseInsensitive.push(constraint.contextName)
    const operator = operatorFor(constraint)
    if (!operator) {
      return {
        skip: constraint.inverted
          ? `inverted ${constraint.operator} on "${constraint.contextName}" has no exact negation here`
          : `operator ${constraint.operator} on "${constraint.contextName}" has no equivalent here`,
      }
    }
    const values = constraint.values.length
      ? constraint.values
      : constraint.value
        ? [constraint.value]
        : []
    if (values.length === 0) {
      return { skip: `constraint on "${constraint.contextName}" carries no values` }
    }
    constraints.push({ fieldKey: constraint.contextName, operator, values })
  }

  switch (strategyName) {
    case 'default':
      return { constraints, caseInsensitive }

    case 'flexibleRollout': {
      const rollout = strategy.parameters.rollout ?? '100'
      if (rollout !== '100') {
        return {
          skip: `flexibleRollout at ${rollout}% -- percentage rollouts do not exist here yet, so importing it would turn ${rollout}% into 100%`,
        }
      }
      return { constraints, caseInsensitive }
    }

    case 'userWithId': {
      const userIds = (strategy.parameters.userIds ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      if (userIds.length === 0) {
        return { skip: 'userWithId carries no user ids' }
      }
      return {
        constraints: [...constraints, { fieldKey: USER_ID_FIELD, operator: 'in', values: userIds }],
        caseInsensitive,
      }
    }

    case 'remoteAddress':
      return {
        skip: 'remoteAddress matches CIDR ranges, and constraints here compare exact values',
      }

    case 'applicationHostname':
      return { skip: 'applicationHostname has no equivalent context field here' }

    default:
      return { skip: `strategy "${strategyName}" has no equivalent here` }
  }
}

/**
 * Translates an Unleash export into a native document.
 *
 * Pure: no database, no ids, no side effects. Everything it cannot represent
 * comes back as a warning rather than an approximation, and the caller merges
 * those into the import report.
 */
export function toNative(input: unknown): ToNativeResult {
  const source = unleashDocumentSchema.parse(input)
  const warnings: TransferWarning[] = []
  const flagWarnings = new Map<string, TransferWarning[]>()

  const addFlagWarning = (key: string, warning: TransferWarning) => {
    const list = flagWarnings.get(key) ?? []
    list.push(warning)
    flagWarnings.set(key, list)
  }

  /** Types come from how every constraint in the file uses each field. */
  const allConstraints = source.featureStrategies.flatMap((strategy) => strategy.constraints)
  const inferred = inferFieldTypes(source.contextFields, allConstraints)

  const needsUserId = source.featureStrategies.some(
    (strategy) => (strategy.strategyName ?? strategy.name) === 'userWithId' && !strategy.disabled,
  )
  if (needsUserId && !inferred.has(USER_ID_FIELD)) {
    inferred.set(USER_ID_FIELD, {
      key: USER_ID_FIELD,
      type: 'string',
      enumValues: null,
      description: 'Created by the Unleash import for userWithId strategies',
      conflicted: false,
    })
  }

  for (const field of inferred.values()) {
    if (!field.conflicted) continue
    warnings.push({
      kind: 'behaviour-change',
      detail: `Context field "${field.key}" is compared as more than one type in this file; it was created as a string, and constraints needing another type were dropped.`,
    })
  }

  const operatorFor = (constraint: UnleashConstraint): string | null => {
    /** `inverted` negates the constraint, so it needs the opposite operator. */
    const operator = constraint.inverted
      ? INVERTED_FROM_UNLEASH_OPERATOR[constraint.operator]
      : FROM_UNLEASH_OPERATOR[constraint.operator]
    if (!operator) return null
    const field = inferred.get(constraint.contextName)
    /** SEMVER_EQ and NUM_EQ both map to "eq"; the field type disambiguates. */
    if (field?.type === 'enum' && !['in', 'notIn', 'equals'].includes(operator)) return null
    return operator
  }

  const archived = source.features.filter((feature) => feature.archived)
  if (archived.length > 0) {
    warnings.push({
      kind: 'unsupported-strategy',
      detail: `Archived in Unleash, so not imported: ${archived.map((f) => f.name).join(', ')}`,
    })
  }

  if (source.segments.length > 0) {
    warnings.push({
      kind: 'unsupported-strategy',
      detail: `${source.segments.length} segment(s) were not imported; segments have no equivalent here.`,
    })
  }
  if (source.featureTags.length > 0) {
    warnings.push({
      kind: 'unsupported-strategy',
      detail: `${source.featureTags.length} tag(s) were not imported; flags carry no tags here.`,
    })
  }
  const variantCount =
    source.featureEnvironments.filter((entry) => entry.variants.length > 0).length +
    source.featureStrategies.filter((strategy) => strategy.variants.length > 0).length
  if (variantCount > 0) {
    warnings.push({
      kind: 'unsupported-strategy',
      detail: `${variantCount} variant set(s) were not imported; flags are boolean here.`,
    })
  }

  /**
   * Every environment the export mentions anywhere. An export taken from one
   * Unleash environment names exactly one, which is what makes the inference
   * below safe.
   */
  const documentEnvironments = new Set(source.featureEnvironments.map((e) => e.environment))
  /** Environments strategies were placed in by inference, for one summary warning. */
  const inferredPlacements = new Map<string, number>()

  const flags: NativeDocument['flags'] = []
  for (const feature of source.features) {
    if (feature.archived) continue

    const environments: NativeDocument['flags'][number]['environments'] = {}
    for (const entry of source.featureEnvironments) {
      if (entry.featureName !== feature.name) continue
      environments[entry.environment] = { enabled: entry.enabled, strategies: [] }
    }

    /**
     * Unleash's single-environment export writes no `environment` on a
     * strategy -- the environment is the one the export was taken from, and it
     * shows up only on the feature's own state rows. When the feature has
     * exactly one of those, or the whole export describes exactly one
     * environment, there is nothing to guess at: that is where the strategy
     * belongs. Only a genuinely ambiguous strategy is dropped below.
     */
    const featureEnvironmentSlugs = Object.keys(environments)
    const impliedEnvironment =
      featureEnvironmentSlugs.length === 1
        ? featureEnvironmentSlugs[0]
        : documentEnvironments.size === 1
          ? [...documentEnvironments][0]
          : undefined

    const ordered = source.featureStrategies
      .filter((strategy) => strategy.featureName === feature.name)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    for (const strategy of ordered) {
      const environmentSlug = strategy.environment ?? impliedEnvironment
      /**
       * Still nothing to place it against: the export names several
       * environments and this strategy says nothing about which one it is for.
       * Guessing would switch targeting on somewhere the export never said.
       */
      if (!environmentSlug) {
        addFlagWarning(feature.name, {
          kind: 'unknown-environment',
          detail:
            'Strategy dropped: the export does not say which environment it belongs to, and it ' +
            'describes more than one. Rebuild it by hand in the right environment.',
        })
        continue
      }
      if (!strategy.environment) {
        inferredPlacements.set(environmentSlug, (inferredPlacements.get(environmentSlug) ?? 0) + 1)
      }
      /** A strategy can name an environment the feature has no state row for. */
      environments[environmentSlug] ??= { enabled: false, strategies: [] }

      const converted = convertStrategy(strategy, operatorFor)
      if ('skip' in converted) {
        addFlagWarning(feature.name, {
          environment: environmentSlug,
          kind: 'unsupported-strategy',
          detail: `Strategy dropped: ${converted.skip}. Rebuild it by hand rather than importing a wider rule.`,
        })
        continue
      }
      if (converted.caseInsensitive.length > 0) {
        addFlagWarning(feature.name, {
          environment: environmentSlug,
          kind: 'behaviour-change',
          detail: `Constraint on ${converted.caseInsensitive.map((key) => `"${key}"`).join(', ')} ignored case in Unleash; matching here is case-sensitive, so it now matches fewer callers.`,
        })
      }
      environments[environmentSlug].strategies.push({ constraints: converted.constraints })
    }

    flags.push({
      key: feature.name,
      name: feature.name,
      description: feature.description ?? null,
      environments,
    })
  }

  if (inferredPlacements.size > 0) {
    const total = [...inferredPlacements.values()].reduce((sum, count) => sum + count, 0)
    const placed = [...inferredPlacements.entries()]
      .map(([slug, count]) => `${count} in "${slug}"`)
      .join(', ')
    warnings.push({
      kind: 'unknown-environment',
      detail:
        `${total} strategy/strategies named no environment, so they were placed in the only one ` +
        `the export describes for their flag: ${placed}. This is how Unleash writes a ` +
        `single-environment export -- check the environment is the one you meant.`,
    })
  }

  const document: NativeDocument = {
    format: NATIVE_FORMAT,
    version: NATIVE_VERSION,
    exportedAt: new Date().toISOString(),
    contextFields: [...inferred.values()]
      .map((field) => ({
        key: field.key,
        type: field.type,
        description: field.description,
        enumValues: field.enumValues,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    flags,
  }

  return { document, warnings, flagWarnings }
}

/* ── Native document -> Unleash document ─────────────────────────────────── */

export interface FromNativeResult {
  document: UnleashDocument
  warnings: TransferWarning[]
}

/**
 * Translates a native document into Unleash's import shape.
 *
 * Every collection Unleash's importer looks for is present, empty where we
 * have nothing to put in it. A strategy whose constraints Unleash cannot
 * express is omitted rather than weakened, and named in `warnings` -- which is
 * why export returns an envelope rather than a bare document.
 */
export function fromNative(document: NativeDocument): FromNativeResult {
  const warnings: TransferWarning[] = []
  const typeByKey = new Map(document.contextFields.map((field) => [field.key, field.type]))

  const features: UnleashDocument['features'] = []
  const featureEnvironments: UnleashDocument['featureEnvironments'] = []
  const featureStrategies: UnleashDocument['featureStrategies'] = []

  for (const flag of document.flags) {
    features.push({
      name: flag.key,
      description: flag.description ?? '',
      type: 'release',
      stale: false,
      impressionData: false,
      archived: false,
    })

    for (const [slug, state] of Object.entries(flag.environments)) {
      featureEnvironments.push({
        featureName: flag.key,
        environment: slug,
        enabled: state.enabled,
        variants: [],
      })

      let sortOrder = 0
      for (const strategy of state.strategies) {
        const constraints: UnleashConstraintOut[] = []
        let dropped: string | null = null

        for (const constraint of strategy.constraints) {
          const converted = toUnleashConstraint(
            constraint,
            typeByKey.get(constraint.fieldKey) ?? 'string',
          )
          if (!converted) {
            dropped = `operator "${constraint.operator}" on "${constraint.fieldKey}" has no Unleash equivalent`
            break
          }
          constraints.push(converted)
        }

        if (dropped) {
          warnings.push({
            environment: slug,
            kind: 'unsupported-operator',
            detail: `Strategy on "${flag.key}" was left out of the Unleash export: ${dropped}.`,
          })
          continue
        }

        featureStrategies.push({
          featureName: flag.key,
          environment: slug,
          strategyName: 'default',
          sortOrder: sortOrder++,
          disabled: false,
          parameters: {},
          constraints,
          variants: [],
          segments: [],
        })
      }
    }
  }

  return {
    document: {
      features,
      featureEnvironments,
      featureStrategies,
      contextFields: document.contextFields.map((field) => ({
        name: field.key,
        description: field.description ?? '',
        legalValues: (field.enumValues ?? []).map((value) => ({ value })),
      })),
      featureTags: [],
      segments: [],
      tagTypes: [],
      dependencies: [],
    },
    warnings,
  }
}
