import { describe, expect, it } from 'vitest'

import { constraintError, type FieldRule } from '../../src/modules/strategies/constraint-rules.js'

const fields = new Map<string, FieldRule>([
  ['tenant', { key: 'tenant', type: 'string', enumValues: null }],
  ['plan', { key: 'plan', type: 'enum', enumValues: ['free', 'pro'] }],
  ['age', { key: 'age', type: 'number', enumValues: null }],
])

describe('constraintError', () => {
  it('accepts a legal constraint', () => {
    expect(
      constraintError(fields, { fieldKey: 'tenant', operator: 'in', values: ['acme'] }),
    ).toBeNull()
  })

  it('rejects an unknown field', () => {
    expect(constraintError(fields, { fieldKey: 'nope', operator: 'in', values: ['x'] })).toBe(
      'Unknown context field: "nope"',
    )
  })

  it('rejects an operator the field type does not allow', () => {
    expect(constraintError(fields, { fieldKey: 'age', operator: 'contains', values: ['3'] })).toBe(
      'Operator "contains" is not valid for number field "age"',
    )
  })

  it('rejects an enum value outside the allowed set', () => {
    expect(
      constraintError(fields, { fieldKey: 'plan', operator: 'equals', values: ['enterprise'] }),
    ).toBe('Value "enterprise" is not an allowed value for "plan"')
  })

  describe('regex patterns', () => {
    const regex = (pattern: string) =>
      constraintError(fields, { fieldKey: 'tenant', operator: 'regex', values: [pattern] })

    it.each([
      '^ac',
      '^(pro|free)$',
      '[a-z]+@[a-z]+',
      '.*@acme\\.com$',
      '^tenant_[a-zA-Z0-9]+$',
      '\\d{4}-\\d{2}-\\d{2}',
    ])('accepts the ordinary pattern %s', (pattern) => {
      expect(regex(pattern)).toBeNull()
    })

    it.each(['(a+)+$', '(x+x+)+y', '^(\\w+\\s?)*$', '([a-z]+)*$', '(a*)*b'])(
      'rejects the catastrophic pattern %s',
      (pattern) => {
        expect(regex(pattern)).toContain('can hang flag evaluation')
      },
    )

    it('rejects a pattern that is not valid regex at all', () => {
      expect(regex('^(unclosed')).toBe('"^(unclosed" is not a valid regular expression')
    })

    it('leaves other operators alone', () => {
      expect(regex('(a+)+$')).not.toBeNull()
      expect(
        constraintError(fields, { fieldKey: 'tenant', operator: 'equals', values: ['(a+)+$'] }),
      ).toBeNull()
    })
  })

  it('accepts an enum field with no declared values', () => {
    const loose = new Map<string, FieldRule>([
      ['free', { key: 'free', type: 'enum', enumValues: null }],
    ])
    expect(constraintError(loose, { fieldKey: 'free', operator: 'in', values: ['x'] })).toBeNull()
  })
})
