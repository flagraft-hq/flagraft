import { describe, expect, it } from 'vitest'

import {
  createContextFieldSchema,
  updateContextFieldSchema,
} from '../../src/modules/context-fields/context-field.schema.js'

describe('createContextFieldSchema', () => {
  describe('key validation', () => {
    it.each(['userId', 'user_id', 'user.id', 'user-id', '_private', 'A1'])(
      'accepts valid key %s',
      (key) => {
        const result = createContextFieldSchema.safeParse({ key })
        expect(result.success).toBe(true)
      },
    )

    it.each(['1leading', '.dot', '-dash', 'has space', 'bad$char', ''])(
      'rejects invalid key %s',
      (key) => {
        const result = createContextFieldSchema.safeParse({ key })
        expect(result.success).toBe(false)
      },
    )

    it('rejects a key longer than 64 chars', () => {
      const result = createContextFieldSchema.safeParse({ key: 'a'.repeat(65) })
      expect(result.success).toBe(false)
    })
  })

  describe('defaults', () => {
    it('defaults type=string', () => {
      const result = createContextFieldSchema.parse({ key: 'plan' })
      expect(result).toMatchObject({ type: 'string' })
    })
  })

  describe('enumValues rules', () => {
    it('requires non-empty enumValues when type is enum', () => {
      expect(createContextFieldSchema.safeParse({ key: 'plan', type: 'enum' }).success).toBe(false)
      expect(
        createContextFieldSchema.safeParse({ key: 'plan', type: 'enum', enumValues: [] }).success,
      ).toBe(false)
      expect(
        createContextFieldSchema.safeParse({
          key: 'plan',
          type: 'enum',
          enumValues: ['free', 'pro'],
        }).success,
      ).toBe(true)
    })

    it('rejects enumValues for a non-enum type', () => {
      const result = createContextFieldSchema.safeParse({
        key: 'plan',
        type: 'string',
        enumValues: ['a'],
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateContextFieldSchema', () => {
  it('does not accept a key field (key is immutable)', () => {
    const parsed = updateContextFieldSchema.parse({ key: 'ignored', type: 'string' }) as Record<
      string,
      unknown
    >
    expect(parsed.key).toBeUndefined()
  })

  it('applies the same enum rules as create', () => {
    expect(updateContextFieldSchema.safeParse({ type: 'enum' }).success).toBe(false)
    expect(updateContextFieldSchema.safeParse({ type: 'enum', enumValues: ['a'] }).success).toBe(
      true,
    )
  })

  it('requires type so a partial body cannot silently reset the field', () => {
    // no type -> rejected (would otherwise default to "string" and drop enumValues)
    expect(updateContextFieldSchema.safeParse({ description: 'just a note' }).success).toBe(false)
    expect(
      updateContextFieldSchema.safeParse({ type: 'string', description: 'just a note' }).success,
    ).toBe(true)
  })
})
