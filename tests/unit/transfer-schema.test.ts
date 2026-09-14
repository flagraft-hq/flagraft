import { describe, expect, it } from 'vitest'

import {
  importOptionsSchema,
  nativeDocumentSchema,
  summariseIssues,
} from '../../src/modules/transfer/transfer.schema.js'

const minimal = { format: 'flagraft.export', version: 1 }

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
