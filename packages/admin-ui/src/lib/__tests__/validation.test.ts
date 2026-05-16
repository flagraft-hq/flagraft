import { describe, it, expect } from 'vitest'
import { validateOperator, validateValue, isDuplicate, validateOverrideForm } from '../validation'
import type { Override, ContextField } from '../types'

function makeOverride(partial: Partial<Override> = {}): Override {
  return {
    id: 'o1',
    flag: 'flag-a',
    env: 'production',
    key: 'userId',
    op: 'equals',
    val: 'alice',
    result: true,
    note: '',
    created: '2024-01-01',
    ...partial,
  }
}

function makeField(partial: Partial<ContextField> = {}): ContextField {
  return {
    key: 'userId',
    type: 'string',
    source: 'sdk',
    required: false,
    example: 'alice',
    desc: 'User ID',
    usedIn: 1,
    ...partial,
  }
}

describe('validateOperator', () => {
  it('returns null for valid operator+type combo', () => {
    expect(validateOperator('equals', 'string')).toBeNull()
    expect(validateOperator('is', 'boolean')).toBeNull()
    expect(validateOperator('eq', 'number')).toBeNull()
    expect(validateOperator('satisfies', 'version')).toBeNull()
  })

  it('returns error for empty operator', () => {
    expect(validateOperator('', 'string')).toBe('Operator is required')
  })

  it('returns error for operator not valid for type', () => {
    expect(validateOperator('regex', 'boolean')).toBe('Invalid operator for this field type')
    expect(validateOperator('is', 'number')).toBe('Invalid operator for this field type')
    expect(validateOperator('before', 'string')).toBe('Invalid operator for this field type')
  })
})

describe('validateValue', () => {
  it('returns null for valid string value', () => {
    expect(validateValue('hello', 'string', 'equals')).toBeNull()
  })

  it('returns error for empty value', () => {
    expect(validateValue('', 'string', 'equals')).toBe('Value is required')
  })

  it('returns error for boolean type with non-boolean string', () => {
    expect(validateValue('yes', 'boolean', 'is')).toBe('Must be true or false')
    expect(validateValue('1', 'boolean', 'is')).toBe('Must be true or false')
  })

  it('returns null for boolean type with "true"', () => {
    expect(validateValue('true', 'boolean', 'is')).toBeNull()
    expect(validateValue('false', 'boolean', 'is')).toBeNull()
  })

  it('returns error for enum type equals with invalid value when enumValues present', () => {
    const field = makeField({ type: 'enum', enumValues: ['red', 'green', 'blue'] })
    expect(validateValue('yellow', 'enum', 'equals', field)).toBe('Invalid enum value')
  })

  it('returns null for enum type equals with valid value', () => {
    const field = makeField({ type: 'enum', enumValues: ['red', 'green', 'blue'] })
    expect(validateValue('red', 'enum', 'equals', field)).toBeNull()
  })

  it('returns error for enum type "in" with any invalid value', () => {
    const field = makeField({ type: 'enum', enumValues: ['red', 'green', 'blue'] })
    expect(validateValue('red,yellow', 'enum', 'in', field)).toBe('Invalid enum value: yellow')
  })

  it('returns null for enum type "in" with all valid values', () => {
    const field = makeField({ type: 'enum', enumValues: ['red', 'green', 'blue'] })
    expect(validateValue('red,green', 'enum', 'in', field)).toBeNull()
  })

  it('returns error for number type with non-numeric value', () => {
    expect(validateValue('abc', 'number', 'eq')).toBe('Must be a valid number')
    expect(validateValue('', 'number', 'eq')).toBe('Value is required')
  })

  it('returns null for number type with valid number', () => {
    expect(validateValue('42', 'number', 'eq')).toBeNull()
    expect(validateValue('3.14', 'number', 'eq')).toBeNull()
  })

  it('returns error for version type with invalid semver', () => {
    expect(validateValue('1.2', 'version', 'eq')).toBe('Must be a valid semver (e.g. 1.2.3)')
    expect(validateValue('abc', 'version', 'gte')).toBe('Must be a valid semver (e.g. 1.2.3)')
  })

  it('returns null for version type with valid semver', () => {
    expect(validateValue('1.2.3', 'version', 'eq')).toBeNull()
    expect(validateValue('10.0.1', 'version', 'lte')).toBeNull()
  })

  it('skips semver validation for version type with satisfies op', () => {
    expect(validateValue('^1.2.3', 'version', 'satisfies')).toBeNull()
    expect(validateValue('>=1.0.0', 'version', 'satisfies')).toBeNull()
  })
})

describe('isDuplicate', () => {
  it('returns false when no existing overrides', () => {
    expect(isDuplicate({ key: 'userId', op: 'equals', val: 'alice', env: 'prod' }, [])).toBe(false)
  })

  it('returns true when exact match exists', () => {
    const existing = [
      makeOverride({ key: 'userId', op: 'equals', val: 'alice', env: 'production' }),
    ]
    expect(
      isDuplicate({ key: 'userId', op: 'equals', val: 'alice', env: 'production' }, existing),
    ).toBe(true)
  })

  it('returns false when same key+op but different val', () => {
    const existing = [
      makeOverride({ key: 'userId', op: 'equals', val: 'alice', env: 'production' }),
    ]
    expect(
      isDuplicate({ key: 'userId', op: 'equals', val: 'bob', env: 'production' }, existing),
    ).toBe(false)
  })

  it('returns false when excludeId matches the duplicate', () => {
    const existing = [
      makeOverride({ id: 'o1', key: 'userId', op: 'equals', val: 'alice', env: 'production' }),
    ]
    expect(
      isDuplicate({ key: 'userId', op: 'equals', val: 'alice', env: 'production' }, existing, 'o1'),
    ).toBe(false)
  })
})

describe('validateOverrideForm', () => {
  const fields: ContextField[] = [
    makeField({ key: 'userId', type: 'string' }),
    makeField({ key: 'plan', type: 'enum', enumValues: ['free', 'pro'] }),
  ]

  it('returns empty object for valid form data', () => {
    const result = validateOverrideForm(
      { key: 'userId', op: 'equals', val: 'alice', env: 'prod' },
      [],
      fields,
    )
    expect(result).toEqual({})
  })

  it('returns key error when key is empty', () => {
    const result = validateOverrideForm(
      { key: '', op: 'equals', val: 'alice', env: 'prod' },
      [],
      fields,
    )
    expect(result.key).toBe('Context key is required')
  })

  it('returns op error for invalid operator', () => {
    const result = validateOverrideForm(
      { key: 'userId', op: 'is', val: 'alice', env: 'prod' },
      [],
      fields,
    )
    expect(result.op).toBe('Invalid operator for this field type')
  })

  it('returns val error for empty value', () => {
    const result = validateOverrideForm(
      { key: 'userId', op: 'equals', val: '', env: 'prod' },
      [],
      fields,
    )
    expect(result.val).toBe('Value is required')
  })

  it('returns duplicate error when override already exists', () => {
    const existing = [makeOverride({ key: 'userId', op: 'equals', val: 'alice', env: 'prod' })]
    const result = validateOverrideForm(
      { key: 'userId', op: 'equals', val: 'alice', env: 'prod' },
      existing,
      fields,
    )
    expect(result.val).toBe('An identical override already exists')
  })
})
