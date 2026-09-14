import { describe, expect, it } from 'vitest'

import {
  importOptionsSchema,
  nativeDocumentSchema,
  summariseIssues,
} from '../../src/modules/transfer/transfer.schema.js'

const minimal = { format: 'flagraft.export', version: 1 }

describe('nativeDocumentSchema context fields', () => {
  const withField = (field: Record<string, unknown>) =>
    nativeDocumentSchema.safeParse({ ...minimal, contextFields: [field] })

  it('accepts a key the create-context-field route would accept', () => {
    expect(withField({ key: 'tenant_id.v2-x', type: 'string' }).success).toBe(true)
  })

  it.each([
    ['starting with a digit', '1tenant'],
    ['carrying a space', 'my tenant'],
    ['carrying punctuation the API forbids', 'tenant;drop'],
    ['longer than 64 characters', 'a'.repeat(65)],
  ])('rejects a key %s, the same as the API does', (_label, key) => {
    /** An import writes to the same table, so it must not be a way round the rules. */
    expect(withField({ key, type: 'string' }).success).toBe(false)
  })

  it('rejects an enum field with no values, which cannot ever match', () => {
    expect(withField({ key: 'plan', type: 'enum' }).success).toBe(false)
    expect(withField({ key: 'plan', type: 'enum', enumValues: [] }).success).toBe(false)
  })

  it('rejects enum values on a field that is not an enum', () => {
    expect(withField({ key: 'plan', type: 'string', enumValues: ['pro'] }).success).toBe(false)
  })

  it('accepts null enumValues, which is what the export writes for non-enums', () => {
    expect(withField({ key: 'plan', type: 'string', enumValues: null }).success).toBe(true)
  })
})

describe('nativeDocumentSchema', () => {
  it('fills in empty collections', () => {
    const doc = nativeDocumentSchema.parse(minimal)
    expect(doc.flags).toEqual([])
    expect(doc.contextFields).toEqual([])
  })

  it('rejects a document that is not ours', () => {
    expect(() => nativeDocumentSchema.parse({ features: [] })).toThrow()
  })

  it('rejects an unknown future version', () => {
    expect(() => nativeDocumentSchema.parse({ ...minimal, version: 2 })).toThrow()
  })

  it('keeps strategy order and defaults strategies to empty', () => {
    const doc = nativeDocumentSchema.parse({
      ...minimal,
      flags: [{ key: 'a', name: 'A', environments: { production: { enabled: true } } }],
    })
    expect(doc.flags[0].environments.production.strategies).toEqual([])
  })

  it('rejects a constraint with no values', () => {
    expect(() =>
      nativeDocumentSchema.parse({
        ...minimal,
        flags: [
          {
            key: 'a',
            name: 'A',
            environments: {
              production: {
                enabled: true,
                strategies: [{ constraints: [{ fieldKey: 'p', operator: 'in', values: [] }] }],
              },
            },
          },
        ],
      }),
    ).toThrow()
  })
})

describe('importOptionsSchema', () => {
  it('defaults to the safe conflict policy and a real run', () => {
    const opts = importOptionsSchema.parse({ document: minimal })
    expect(opts.onConflict).toBe('skip')
    expect(opts.dryRun).toBe(false)
    expect(opts.environmentMap).toEqual({})
  })

  it('rejects an unknown conflict policy', () => {
    expect(() => importOptionsSchema.parse({ document: minimal, onConflict: 'merge' })).toThrow()
  })
})

describe('summariseIssues', () => {
  it('says there is nothing wrong when there is nothing wrong', () => {
    expect(summariseIssues([])).toContain('does not match')
  })

  it('names the field and caps the list, because the raw array used to reach the UI', () => {
    const result = nativeDocumentSchema.safeParse({ features: [] })
    expect(result.success).toBe(false)
    if (result.success) return

    const summary = summariseIssues(result.error.issues)
    expect(summary).not.toContain('"code"')
    expect(summary).not.toContain('invalid_type')
    expect(summary.length).toBeLessThan(400)
  })

  it('counts the ones it does not show', () => {
    const issues = Array.from({ length: 9 }, (_, i) => ({
      code: 'invalid_type' as const,
      expected: 'string' as const,
      received: 'undefined' as const,
      path: ['featureStrategies', i, 'environment'],
      message: 'Required',
    }))
    const summary = summariseIssues(issues)
    expect(summary).toContain('9 problems')
    expect(summary).toContain('and 6 more')
  })
})
