import { describe, expect, it } from 'vitest'

import { putStrategiesSchema } from '../../src/modules/strategies/strategy.schema.js'

describe('putStrategiesSchema', () => {
  it('accepts a valid strategy list', () => {
    const result = putStrategiesSchema.safeParse({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg'] }] }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty strategies array (clears the list)', () => {
    expect(putStrategiesSchema.safeParse({ strategies: [] }).success).toBe(true)
  })

  it('accepts a strategy with no constraints (always matches)', () => {
    expect(putStrategiesSchema.safeParse({ strategies: [{ constraints: [] }] }).success).toBe(true)
  })

  it('rejects a constraint with no values', () => {
    const result = putStrategiesSchema.safeParse({
      strategies: [{ constraints: [{ fieldKey: 'tenant', operator: 'in', values: [] }] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a constraint missing fieldKey or operator', () => {
    expect(
      putStrategiesSchema.safeParse({
        strategies: [{ constraints: [{ operator: 'in', values: ['x'] }] }],
      }).success,
    ).toBe(false)
    expect(
      putStrategiesSchema.safeParse({
        strategies: [{ constraints: [{ fieldKey: 'tenant', values: ['x'] }] }],
      }).success,
    ).toBe(false)
  })
})
