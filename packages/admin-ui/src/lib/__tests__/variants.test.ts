import { describe, it, expect } from 'vitest'
import { fillWeights, formatPercent, percentToWeight } from '../variants'

describe('fillWeights', () => {
  it('splits evenly and gives the remainder to the first variable variants', () => {
    expect(fillWeights([null, null, null])).toEqual([334, 333, 333])
  })

  it('shares what fixed weights leave', () => {
    expect(fillWeights([500, null, null])).toEqual([500, 250, 250])
    expect(fillWeights([333, null, null])).toEqual([333, 334, 333])
    expect(fillWeights([1000, null])).toEqual([1000, 0])
  })

  it('keeps fixed weights that total 1000', () => {
    expect(fillWeights([100, 900])).toEqual([100, 900])
  })

  it('returns null when the fixed weights cannot work', () => {
    expect(fillWeights([600, 500, null])).toBeNull()
    expect(fillWeights([400, 500])).toBeNull()
  })

  it('handles an empty list', () => {
    expect(fillWeights([])).toEqual([])
  })
})

describe('percent conversion', () => {
  it('converts a typed percentage to a weight out of 1000', () => {
    expect(percentToWeight('10')).toBe(100)
    expect(percentToWeight('33.3')).toBe(333)
    expect(percentToWeight('100')).toBe(1000)
  })

  it('rejects anything that is not 0 to 100', () => {
    expect(percentToWeight('')).toBeNull()
    expect(percentToWeight('abc')).toBeNull()
    expect(percentToWeight('-1')).toBeNull()
    expect(percentToWeight('100.1')).toBeNull()
  })

  it('formats a weight as a percentage', () => {
    expect(formatPercent(500)).toBe('50%')
    expect(formatPercent(333)).toBe('33.3%')
  })
})
