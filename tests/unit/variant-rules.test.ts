import { describe, expect, it } from 'vitest'

import { normaliseVariants } from '../../src/modules/strategies/variant-rules.js'
import type { VariantInput } from '../../src/modules/strategies/variant-rules.js'

const variable = (name: string): VariantInput => ({ name })
const fix = (name: string, weight: number): VariantInput => ({ name, weight, weightType: 'fix' })

function weights(input: VariantInput[]): number[] {
  const result = normaliseVariants(input)
  if ('error' in result) throw new Error(result.error)
  return result.variants.map((variant) => variant.weight)
}

function error(input: VariantInput[]): string {
  const result = normaliseVariants(input)
  if (!('error' in result)) throw new Error('expected an error')
  return result.error
}

describe('normaliseVariants: weights', () => {
  it('accepts an empty list', () => {
    expect(normaliseVariants([])).toEqual({ variants: [] })
  })

  it('splits evenly and gives the remainder to the first variants', () => {
    expect(weights([variable('a'), variable('b'), variable('c')])).toEqual([334, 333, 333])
  })

  it('shares what fixed weights leave', () => {
    expect(weights([fix('a', 500), variable('b'), variable('c')])).toEqual([500, 250, 250])
    expect(weights([fix('a', 333), variable('b'), variable('c')])).toEqual([333, 334, 333])
  })

  it('keeps fixed weights that total 1000', () => {
    expect(weights([fix('a', 100), fix('b', 900)])).toEqual([100, 900])
  })

  it('gives variable variants 0 when fixed weights take everything', () => {
    expect(weights([fix('a', 1000), variable('b')])).toEqual([1000, 0])
  })

  it('ignores a weight supplied on a variable variant', () => {
    expect(weights([{ name: 'a', weight: 900 }, variable('b')])).toEqual([500, 500])
  })

  it('rejects fixed weights that do not total 1000 when nothing is variable', () => {
    expect(error([fix('a', 400), fix('b', 500)])).toContain('1000')
  })

  it('rejects fixed weights above 1000 in total', () => {
    expect(error([fix('a', 600), fix('b', 500), variable('c')])).toContain('1100')
  })

  it.each([1.5, -1, 1001, undefined])('rejects fixed weight %s', (weight) => {
    expect(error([{ name: 'a', weight, weightType: 'fix' }, variable('b')])).toContain('"a"')
  })
})

describe('normaliseVariants: shape', () => {
  it('fills in defaults', () => {
    expect(normaliseVariants([variable('a')])).toEqual({
      variants: [{ name: 'a', weight: 1000, weightType: 'variable', stickiness: 'default' }],
    })
  })

  it('keeps payload and stickiness', () => {
    const payload = { type: 'json' as const, value: '{"a":1}' }
    expect(normaliseVariants([{ name: 'a', stickiness: 'tenant', payload }])).toEqual({
      variants: [
        { name: 'a', weight: 1000, weightType: 'variable', stickiness: 'tenant', payload },
      ],
    })
  })

  it('rejects duplicate names', () => {
    expect(error([variable('a'), variable('a')])).toContain('"a"')
  })

  it('rejects mixed stickiness', () => {
    expect(error([{ name: 'a', stickiness: 'userId' }, { name: 'b' }])).toContain('stickiness')
  })

  it('rejects empty and overlong names', () => {
    expect(error([variable('')])).toContain('100')
    expect(error([variable('x'.repeat(101))])).toContain('100')
  })

  it('rejects more than 20 variants', () => {
    const many = Array.from({ length: 21 }, (_, index) => variable(`v${index}`))
    expect(error(many)).toContain('20')
  })

  it('rejects a json payload that does not parse', () => {
    expect(error([{ name: 'a', payload: { type: 'json', value: '{a' } }])).toContain('JSON')
  })

  it.each(['abc', '', ' '])('rejects number payload "%s"', (value) => {
    expect(error([{ name: 'a', payload: { type: 'number', value } }])).toContain('number')
  })

  it('accepts a numeric payload', () => {
    expect(weights([{ name: 'a', payload: { type: 'number', value: '1.2' } }])).toEqual([1000])
  })

  it('rejects an oversized payload', () => {
    const payload = { type: 'string' as const, value: 'x'.repeat(10_001) }
    expect(error([{ name: 'a', payload }])).toContain('10000')
  })
})
