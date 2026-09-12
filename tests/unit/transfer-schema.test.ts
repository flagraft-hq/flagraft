import { describe, expect, it } from 'vitest'

import {
  importOptionsSchema,
  nativeDocumentSchema,
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
