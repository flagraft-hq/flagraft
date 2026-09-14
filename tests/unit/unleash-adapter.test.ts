import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  FROM_UNLEASH_OPERATOR,
  TO_UNLEASH_OPERATOR,
  UNREPRESENTABLE_IN_UNLEASH,
  fromNative,
  inferFieldTypes,
  toNative,
  toUnleashConstraint,
} from '../../src/modules/transfer/external/unleash.adapter.js'
import { unleashDocumentSchema } from '../../src/modules/transfer/external/unleash.schema.js'
import { OPERATORS_BY_TYPE } from '../../src/modules/strategies/strategy.schema.js'
import { nativeDocumentSchema } from '../../src/modules/transfer/transfer.schema.js'

const fixture: unknown = JSON.parse(readFileSync('tests/fixtures/unleash-export.json', 'utf8'))

describe('unleashDocumentSchema', () => {
  it('parses a real export', () => {
    expect(() => unleashDocumentSchema.parse(fixture)).not.toThrow()
  })

  it('tolerates keys we do not read', () => {
    expect(() =>
      unleashDocumentSchema.parse({ ...(fixture as object), somethingNew: [{ a: 1 }] }),
    ).not.toThrow()
  })

  it('defaults the collections it does not find', () => {
    const parsed = unleashDocumentSchema.parse({ features: [] })
    expect(parsed.featureStrategies).toEqual([])
    expect(parsed.contextFields).toEqual([])
  })

  it('rejects a document with no features array', () => {
    expect(() => unleashDocumentSchema.parse({ flags: [] })).toThrow()
  })
})

describe('operator tables', () => {
  it('maps the operators the spec says it maps', () => {
    expect(FROM_UNLEASH_OPERATOR.IN).toBe('in')
    expect(FROM_UNLEASH_OPERATOR.NOT_IN).toBe('notIn')
    expect(FROM_UNLEASH_OPERATOR.STR_CONTAINS).toBe('contains')
    expect(FROM_UNLEASH_OPERATOR.STR_STARTS_WITH).toBe('startsWith')
    expect(FROM_UNLEASH_OPERATOR.NUM_EQ).toBe('eq')
    expect(FROM_UNLEASH_OPERATOR.NUM_GTE).toBe('gte')
    expect(FROM_UNLEASH_OPERATOR.DATE_AFTER).toBe('after')
    expect(FROM_UNLEASH_OPERATOR.SEMVER_EQ).toBe('eq')
  })

  it('has no mapping for the ones we cannot express', () => {
    for (const op of ['STR_ENDS_WITH', 'SEMVER_GT', 'SEMVER_LT', 'NUM_NEQ']) {
      expect(FROM_UNLEASH_OPERATOR[op]).toBeUndefined()
    }
  })

  it('maps back, including the two that need a single value', () => {
    expect(TO_UNLEASH_OPERATOR.in).toEqual({ operator: 'IN' })
    expect(TO_UNLEASH_OPERATOR.equals).toEqual({ operator: 'IN', singleValue: true })
    expect(TO_UNLEASH_OPERATOR.is).toEqual({ operator: 'IN', singleValue: true })
  })

  it('has no reverse mapping for the ones Unleash lacks', () => {
    for (const op of ['regex', 'neq', 'satisfies']) {
      expect(TO_UNLEASH_OPERATOR[op]).toBeUndefined()
    }
  })

  it('refuses an inclusive semver bound but allows the numeric one', () => {
    const constraint = { fieldKey: 'v', operator: 'gte', values: ['1.2.0'] }
    expect(toUnleashConstraint(constraint, 'version')).toBeNull()
    expect(toUnleashConstraint({ ...constraint, fieldKey: 'n' }, 'number')).toMatchObject({
      operator: 'NUM_GTE',
    })
  })

  it('every operator in the model is either mapped or deliberately absent', () => {
    /**
     * Guards against adding an operator to OPERATORS_BY_TYPE and forgetting
     * the adapter. Add it to UNREPRESENTABLE_IN_UNLEASH when that is the
     * answer, rather than letting it drop silently.
     */
    const all = new Set(Object.values(OPERATORS_BY_TYPE).flat())
    for (const op of all) {
      const handled = op in TO_UNLEASH_OPERATOR || UNREPRESENTABLE_IN_UNLEASH.has(op)
      expect(handled, `operator "${op}" is neither mapped nor listed as unrepresentable`).toBe(true)
    }
  })
})

describe('inferFieldTypes', () => {
  const field = (name: string, legalValues: { value: string }[] = []) => ({
    name,
    description: '',
    legalValues,
  })
  const constraint = (contextName: string, operator: string) => ({
    contextName,
    operator,
    values: ['1'],
    caseInsensitive: false,
    inverted: false,
  })

  it('reads legalValues as an enum', () => {
    const types = inferFieldTypes([field('plan', [{ value: 'pro' }])], [])
    expect(types.get('plan')).toMatchObject({ type: 'enum', enumValues: ['pro'] })
  })

  it('infers version, date and number from the operators used', () => {
    const types = inferFieldTypes(
      [field('v'), field('d'), field('n')],
      [constraint('v', 'SEMVER_EQ'), constraint('d', 'DATE_AFTER'), constraint('n', 'NUM_GT')],
    )
    expect(types.get('v')?.type).toBe('version')
    expect(types.get('d')?.type).toBe('date')
    expect(types.get('n')?.type).toBe('number')
  })

  it('prefers an operator family over legalValues', () => {
    const types = inferFieldTypes(
      [field('build', [{ value: '1.0.0' }])],
      [constraint('build', 'SEMVER_EQ')],
    )
    expect(types.get('build')?.type).toBe('version')
  })

  it('falls back to string when nothing indicates a type', () => {
    const types = inferFieldTypes([field('tenant')], [constraint('tenant', 'IN')])
    expect(types.get('tenant')?.type).toBe('string')
  })

  it('falls back to string on conflicting operators and says so', () => {
    const types = inferFieldTypes(
      [field('weird')],
      [constraint('weird', 'NUM_GT'), constraint('weird', 'DATE_AFTER')],
    )
    expect(types.get('weird')).toMatchObject({ type: 'string', conflicted: true })
  })

  it('registers a field that only appears in a constraint', () => {
    const types = inferFieldTypes([], [constraint('undeclared', 'IN')])
    expect(types.get('undeclared')?.type).toBe('string')
  })

  it('ignores operators it cannot map when deciding the type', () => {
    const types = inferFieldTypes([field('email')], [constraint('email', 'STR_ENDS_WITH')])
    expect(types.get('email')?.type).toBe('string')
    expect(types.get('email')?.conflicted).toBe(false)
  })
})

describe('toNative', () => {
  const result = () => toNative(fixture)
  const warningsFor = (key: string) => result().flagWarnings.get(key) ?? []
  const details = (key: string) =>
    warningsFor(key)
      .map((warning) => warning.detail)
      .join(' | ')

  it('produces a valid native document', () => {
    expect(() => nativeDocumentSchema.parse(result().document)).not.toThrow()
  })

  it('skips archived features and reports them', () => {
    const { document, warnings } = result()
    expect(document.flags.map((flag) => flag.key)).toEqual(['new-checkout'])
    expect(warnings.some((warning) => warning.detail.includes('legacy-banner'))).toBe(true)
  })

  it('uses the Unleash name as both key and name', () => {
    expect(result().document.flags[0]).toMatchObject({
      key: 'new-checkout',
      name: 'new-checkout',
    })
  })

  it('carries the per-environment enabled state', () => {
    const envs = result().document.flags[0].environments
    expect(envs.development.enabled).toBe(true)
    expect(envs.production.enabled).toBe(false)
    expect(envs.staging.enabled).toBe(true)
  })

  it('keeps a 100% flexibleRollout, with its constraints', () => {
    const production = result().document.flags[0].environments.production
    expect(production.strategies[0]).toEqual({
      constraints: [{ fieldKey: 'appVersion', operator: 'eq', values: ['2.1.0'] }],
    })
  })

  it('skips a flexibleRollout below 100 and says the percentage', () => {
    const rollout = warningsFor('new-checkout').find((warning) =>
      warning.detail.includes('flexibleRollout'),
    )
    expect(rollout).toMatchObject({
      environment: 'development',
      kind: 'unsupported-strategy',
    })
    expect(rollout?.detail).toContain('50')
  })

  it('maps userWithId to a userId in-constraint and declares the field', () => {
    const production = result().document.flags[0].environments.production
    expect(production.strategies).toEqual(
      expect.arrayContaining([
        { constraints: [{ fieldKey: 'userId', operator: 'in', values: ['u-1', 'u-2'] }] },
      ]),
    )
    expect(result().document.contextFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'userId', type: 'string' })]),
    )
  })

  it('skips remoteAddress because CIDR is not exact matching', () => {
    expect(details('new-checkout')).toContain('remoteAddress')
  })

  it('skips a disabled strategy and labels it as intentionally off', () => {
    expect(details('new-checkout').toLowerCase()).toContain('disabled')
  })

  it('skips a strategy whose constraint uses an unmappable operator', () => {
    expect(details('new-checkout')).toContain('STR_ENDS_WITH')
  })

  it('imports an inverted constraint as its negated operator', () => {
    /** Unleash writes "not in one of" as NOT_IN with inverted set; that is our `in`. */
    const production = result().document.flags[0].environments.production
    expect(production.strategies).toEqual(
      expect.arrayContaining([
        { constraints: [{ fieldKey: 'plan', operator: 'in', values: ['free'] }] },
      ]),
    )
  })

  it('skips a strategy that references a segment', () => {
    expect(details('new-checkout').toLowerCase()).toContain('segment')
  })

  it('orders the surviving strategies by sortOrder', () => {
    const production = result().document.flags[0].environments.production
    /**
     * sortOrder 0 (flexibleRollout 100), 1 (userWithId) and 4 (an inverted
     * NOT_IN, which negates to `in`); 2, 3 and 5 dropped.
     */
    expect(production.strategies).toEqual([
      { constraints: [{ fieldKey: 'appVersion', operator: 'eq', values: ['2.1.0'] }] },
      { constraints: [{ fieldKey: 'userId', operator: 'in', values: ['u-1', 'u-2'] }] },
      { constraints: [{ fieldKey: 'plan', operator: 'in', values: ['free'] }] },
    ])
  })

  it('reports dropped segments, tags and variants once each', () => {
    const { warnings } = result()
    for (const term of ['segment', 'tag', 'variant']) {
      expect(
        warnings.filter((warning) => warning.detail.toLowerCase().includes(term)),
        term,
      ).toHaveLength(1)
    }
  })

  it('maps legalValues to enum values', () => {
    expect(result().document.contextFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'plan',
          type: 'enum',
          enumValues: ['free', 'pro', 'enterprise'],
        }),
      ]),
    )
  })
})

describe('fromNative', () => {
  const doc = nativeDocumentSchema.parse({
    format: 'flagraft.export',
    version: 1,
    contextFields: [
      { key: 'plan', type: 'enum', description: null, enumValues: ['free', 'pro'] },
      { key: 'build', type: 'version', description: null, enumValues: null },
    ],
    flags: [
      {
        key: 'a',
        name: 'A',
        description: 'desc',
        environments: {
          production: {
            enabled: true,
            strategies: [
              { constraints: [{ fieldKey: 'plan', operator: 'equals', values: ['pro'] }] },
              { constraints: [{ fieldKey: 'plan', operator: 'regex', values: ['^p'] }] },
              { constraints: [{ fieldKey: 'build', operator: 'gte', values: ['1.2.0'] }] },
            ],
          },
          development: { enabled: false, strategies: [] },
        },
      },
    ],
  })

  it('emits every collection an Unleash import expects', () => {
    const { document } = fromNative(doc)
    for (const key of [
      'features',
      'featureEnvironments',
      'featureStrategies',
      'contextFields',
      'segments',
      'tagTypes',
      'featureTags',
      'dependencies',
    ]) {
      expect(document).toHaveProperty(key)
    }
  })

  it('emits one featureEnvironments row per environment', () => {
    const { document } = fromNative(doc)
    expect(document.featureEnvironments).toHaveLength(2)
    expect(document.featureEnvironments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ featureName: 'a', environment: 'production', enabled: true }),
      ]),
    )
  })

  it('turns equals into a single-value IN on a default strategy', () => {
    const { document } = fromNative(doc)
    expect(document.featureStrategies).toHaveLength(1)
    expect(document.featureStrategies[0]).toMatchObject({
      featureName: 'a',
      environment: 'production',
      strategyName: 'default',
      sortOrder: 0,
    })
    expect(document.featureStrategies[0].constraints[0]).toMatchObject({
      contextName: 'plan',
      operator: 'IN',
      values: ['pro'],
    })
  })

  it('drops a regex strategy and an inclusive semver bound, naming each', () => {
    const { warnings } = fromNative(doc)
    const joined = warnings.map((warning) => warning.detail).join(' | ')
    expect(joined).toContain('regex')
    expect(joined).toContain('gte')
    expect(warnings).toHaveLength(2)
  })

  it('maps enumValues to legalValues', () => {
    const { document } = fromNative(doc)
    const plan = document.contextFields.find((field) => field.name === 'plan')!
    expect(plan.legalValues).toEqual([{ value: 'free' }, { value: 'pro' }])
  })

  it('round-trips what is representable', () => {
    const { document: unleashDoc } = fromNative(doc)
    const { document: back } = toNative(unleashDoc)
    /**
     * `equals` goes out as a one-element IN and comes back as `in`. They mean
     * the same thing, so this asymmetry is correct -- asserted here so nobody
     * "fixes" it later.
     */
    expect(back.flags[0].environments.production.strategies).toEqual([
      { constraints: [{ fieldKey: 'plan', operator: 'in', values: ['pro'] }] },
    ])
    expect(back.flags[0].environments.production.enabled).toBe(true)
    expect(back.flags[0].environments.development.enabled).toBe(false)
  })
})

describe('inverted constraints', () => {
  const base = {
    features: [{ name: 'a', description: '', archived: false }],
    featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
    contextFields: [],
  }

  const withConstraint = (constraint: Record<string, unknown>) =>
    toNative({
      ...base,
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'default',
          parameters: {},
          constraints: [constraint],
        },
      ],
    })

  const strategiesOf = (result: ReturnType<typeof toNative>) =>
    result.document.flags[0].environments.production.strategies

  it.each([
    ['IN', 'notIn'],
    ['NOT_IN', 'in'],
  ])('negates %s to %s', (operator, expected) => {
    const result = withConstraint({
      contextName: 'tenant',
      operator,
      values: ['acme'],
      inverted: true,
    })
    expect(strategiesOf(result)).toEqual([
      { constraints: [{ fieldKey: 'tenant', operator: expected, values: ['acme'] }] },
    ])
  })

  it.each([
    ['NUM_EQ', 'neq'],
    ['NUM_GT', 'lte'],
    ['NUM_GTE', 'lt'],
    ['NUM_LT', 'gte'],
    ['NUM_LTE', 'gt'],
  ])('negates %s to %s, which is exact on numbers', (operator, expected) => {
    const result = withConstraint({
      contextName: 'seats',
      operator,
      values: ['10'],
      inverted: true,
    })
    expect(strategiesOf(result)).toEqual([
      { constraints: [{ fieldKey: 'seats', operator: expected, values: ['10'] }] },
    ])
  })

  it.each(['STR_CONTAINS', 'STR_STARTS_WITH'])(
    'drops an inverted %s, because there is no negated form of it here',
    (operator) => {
      const result = withConstraint({
        contextName: 'email',
        operator,
        values: ['@acme'],
        inverted: true,
      })
      expect(strategiesOf(result)).toEqual([])
      expect(result.flagWarnings.get('a')?.[0].detail).toMatch(/inverted .* has no exact negation/i)
    },
  )

  it.each(['DATE_AFTER', 'DATE_BEFORE'])(
    'drops an inverted %s, because before and after are both strict here',
    (operator) => {
      /**
       * Negating a strict bound loses the boundary instant: NOT(after X) is
       * "on or before X", and the only thing we could store is "before X",
       * which quietly stops matching at exactly X.
       */
      const result = withConstraint({
        contextName: 'signupDate',
        operator,
        values: ['2026-01-01T00:00:00.000Z'],
        inverted: true,
      })
      expect(strategiesOf(result)).toEqual([])
      expect(result.flagWarnings.get('a')?.[0].detail).toMatch(/no exact negation/i)
    },
  )

  it('drops an inverted SEMVER_EQ, because version fields have no neq', () => {
    const result = withConstraint({
      contextName: 'appVersion',
      operator: 'SEMVER_EQ',
      values: ['2.1.0'],
      inverted: true,
    })
    expect(strategiesOf(result)).toEqual([])
  })

  it('keeps the plain meaning when inverted is false', () => {
    const result = withConstraint({
      contextName: 'tenant',
      operator: 'NOT_IN',
      values: ['acme'],
      inverted: false,
    })
    expect(strategiesOf(result)).toEqual([
      { constraints: [{ fieldKey: 'tenant', operator: 'notIn', values: ['acme'] }] },
    ])
  })

  it('negates an enum field into notIn, which enum fields allow', () => {
    const result = toNative({
      ...base,
      contextFields: [{ name: 'plan', legalValues: [{ value: 'pro' }, { value: 'free' }] }],
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'default',
          parameters: {},
          constraints: [{ contextName: 'plan', operator: 'IN', values: ['free'], inverted: true }],
        },
      ],
    })

    expect(result.document.contextFields).toEqual([
      expect.objectContaining({ key: 'plan', type: 'enum' }),
    ])
    expect(strategiesOf(result)).toEqual([
      { constraints: [{ fieldKey: 'plan', operator: 'notIn', values: ['free'] }] },
    ])
  })
})

describe('context field keys Flagraft cannot store', () => {
  it('drops the field and every strategy that used it, rather than writing an illegal key', () => {
    /**
     * Unleash context names are free-form. The import writes to the same table
     * the create route guards, so a name we could not create by hand must not
     * arrive through a file either.
     */
    const { document, warnings, flagWarnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [{ name: 'my tenant', legalValues: [] }],
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'default',
          parameters: {},
          constraints: [
            { contextName: 'my tenant', operator: 'IN', values: ['acme'], inverted: false },
          ],
        },
      ],
    })

    expect(document.contextFields).toEqual([])
    expect(warnings.find((w) => w.detail.includes('my tenant'))?.detail).toMatch(
      /not a legal context field key/i,
    )
    /** The flag still lands; only what depends on the field is gone. */
    expect(document.flags[0].key).toBe('a')
    expect(flagWarnings.get('a')).toBeUndefined()
  })

  it('keeps a legal key untouched', () => {
    const { document, warnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [{ name: 'tenant', legalValues: [] }],
      featureStrategies: [],
    })

    expect(document.contextFields).toEqual([
      expect.objectContaining({ key: 'tenant', type: 'string' }),
    ])
    expect(warnings).toEqual([])
  })
})

describe('case-insensitive constraints', () => {
  it('imports the constraint and reports that matching is now case-sensitive', () => {
    const { document, flagWarnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [],
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'default',
          parameters: {},
          constraints: [
            {
              contextName: 'tenant',
              operator: 'IN',
              values: ['Acme'],
              caseInsensitive: true,
              inverted: false,
            },
          ],
        },
      ],
    })

    /** Narrowing, so it lands -- but nobody should have to discover it. */
    expect(document.flags[0].environments.production.strategies).toEqual([
      { constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['Acme'] }] },
    ])
    expect(flagWarnings.get('a')?.[0]).toMatchObject({
      environment: 'production',
      kind: 'behaviour-change',
    })
    expect(flagWarnings.get('a')?.[0].detail).toMatch(/case-sensitive/i)
  })

  it('says nothing when every constraint was already case-sensitive', () => {
    const { flagWarnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [],
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'default',
          parameters: {},
          constraints: [
            {
              contextName: 'tenant',
              operator: 'IN',
              values: ['acme'],
              caseInsensitive: false,
              inverted: false,
            },
          ],
        },
      ],
    })

    expect(flagWarnings.get('a')).toBeUndefined()
  })
})

describe('tolerating real-world export variations', () => {
  const base = {
    features: [{ name: 'a', description: '', archived: false }],
    featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
    contextFields: [],
  }

  it('parses a document whose strategies carry no environment or strategyName', () => {
    /**
     * Some Unleash versions export exactly this. Rejecting the document meant
     * one odd row blocked every other flag in the file.
     */
    const doc = {
      ...base,
      featureStrategies: [{ featureName: 'a', parameters: {}, constraints: [] }],
    }
    expect(() => unleashDocumentSchema.parse(doc)).not.toThrow()
  })

  it('places a strategy with no environment in the only one the flag has', () => {
    /**
     * This is what an export taken from a single Unleash environment looks
     * like: the environment appears on the feature's state row and nowhere on
     * the strategy. Dropping these meant a migration arrived with every flag
     * wide open, which is the opposite of the fail-safe rule.
     */
    const { document, warnings } = toNative({
      ...base,
      featureStrategies: [
        {
          featureName: 'a',
          strategyName: 'flexibleRollout',
          parameters: { rollout: '100' },
          constraints: [
            { contextName: 'tenant', operator: 'IN', values: ['acme'], inverted: false },
          ],
        },
      ],
    })

    expect(document.flags[0].environments.production.strategies).toEqual([
      { constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['acme'] }] },
    ])
    /** The inference is reported, so nobody finds targeting they did not ask for. */
    expect(warnings.find((w) => w.kind === 'unknown-environment')?.detail).toMatch(
      /placed in the only one/i,
    )
  })

  it('places it in the export-wide environment when the flag has no state row', () => {
    const { document } = toNative({
      features: [
        { name: 'a', description: '', archived: false },
        { name: 'b', archived: false },
      ],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [],
      featureStrategies: [
        { featureName: 'b', strategyName: 'default', parameters: {}, constraints: [] },
      ],
    })

    const b = document.flags.find((flag) => flag.key === 'b')
    expect(b?.environments.production).toEqual({
      enabled: false,
      strategies: [{ constraints: [] }],
    })
  })

  it('drops it when the export describes more than one environment', () => {
    /** Two candidates is a guess, and a guess here turns targeting on somewhere real. */
    const { document, flagWarnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [
        { featureName: 'a', environment: 'production', enabled: true },
        { featureName: 'a', environment: 'development', enabled: true },
      ],
      contextFields: [],
      featureStrategies: [
        { featureName: 'a', strategyName: 'default', parameters: {}, constraints: [] },
      ],
    })

    expect(document.flags[0].environments.production.strategies).toEqual([])
    expect(document.flags[0].environments.development.strategies).toEqual([])
    expect(flagWarnings.get('a')?.[0].kind).toBe('unknown-environment')
    expect(flagWarnings.get('a')?.[0].detail).toMatch(/more than one/i)
  })

  it('keeps an explicit environment over the inferred one', () => {
    const { document, warnings } = toNative({
      features: [{ name: 'a', description: '', archived: false }],
      featureEnvironments: [{ featureName: 'a', environment: 'production', enabled: true }],
      contextFields: [],
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'staging',
          strategyName: 'default',
          parameters: {},
          constraints: [],
        },
      ],
    })

    expect(document.flags[0].environments.staging.strategies).toEqual([{ constraints: [] }])
    expect(document.flags[0].environments.production.strategies).toEqual([])
    expect(warnings.some((w) => w.kind === 'unknown-environment')).toBe(false)
  })

  it('still reports a strategy it cannot name, even once it can place it', () => {
    const { document, flagWarnings } = toNative({
      ...base,
      featureStrategies: [{ featureName: 'a', parameters: {}, constraints: [] }],
    })

    expect(document.flags[0].environments.production.enabled).toBe(true)
    expect(document.flags[0].environments.production.strategies).toEqual([])
    expect(flagWarnings.get('a')?.[0].detail).toMatch(/no name/i)
  })

  it('never guesses a missing strategy name into an always-on rule', () => {
    const { document, flagWarnings } = toNative({
      ...base,
      featureStrategies: [
        { featureName: 'a', environment: 'production', parameters: {}, constraints: [] },
      ],
    })

    /** A nameless strategy with no constraints would match everybody. */
    expect(document.flags[0].environments.production.strategies).toEqual([])
    expect(flagWarnings.get('a')?.[0].detail).toMatch(/no name/i)
  })

  it('accepts `name` as an alias for `strategyName`', () => {
    const { document } = toNative({
      ...base,
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          name: 'default',
          parameters: {},
          constraints: [],
        },
      ],
    })
    expect(document.flags[0].environments.production.strategies).toEqual([{ constraints: [] }])
  })

  it('coerces numeric strategy parameters instead of rejecting them', () => {
    const { document } = toNative({
      ...base,
      featureStrategies: [
        {
          featureName: 'a',
          environment: 'production',
          strategyName: 'flexibleRollout',
          parameters: { rollout: 100 },
          constraints: [],
        },
      ],
    })
    expect(document.flags[0].environments.production.strategies).toEqual([{ constraints: [] }])
  })
})
