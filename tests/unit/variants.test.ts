import { describe, expect, it } from 'vitest'

import { murmur3, selectVariant } from '../../src/modules/client/variants.js'

const v = (name: string, weight: number, stickiness = 'default') => ({
  name,
  weight,
  weightType: 'variable' as const,
  stickiness,
})

const weighted = (stickiness: string, ...weights: number[]) =>
  weights.map((weight, index) => v(`variant${index + 1}`, weight, stickiness))

/** Expected results copied from Unleash client-specification 08-variants.json and 16-strategy-variants.json. */
const UNLEASH_CASES: {
  groupId: string
  context: Record<string, string>
  weights: number[]
  expected: string
  stickiness?: string
}[] = [
  {
    groupId: 'Feature.Variants.B',
    context: { userId: '2' },
    weights: [1, 1],
    expected: 'variant2',
  },
  {
    groupId: 'Feature.Variants.B',
    context: { userId: '0' },
    weights: [1, 1],
    expected: 'variant1',
  },
  {
    groupId: 'Feature.Variants.C',
    context: { userId: '232' },
    weights: [33, 33, 33],
    expected: 'variant1',
  },
  {
    groupId: 'Feature.Variants.C',
    context: { userId: '607' },
    weights: [33, 33, 33],
    expected: 'variant2',
  },
  {
    groupId: 'Feature.Variants.C',
    context: { userId: '656' },
    weights: [33, 33, 33],
    expected: 'variant3',
  },
  {
    groupId: 'Feature.Variants.D',
    context: { userId: '712' },
    weights: [1, 49, 50],
    expected: 'variant1',
  },
  {
    groupId: 'Feature.Variants.D',
    context: { userId: '525' },
    weights: [1, 49, 50],
    expected: 'variant2',
  },
  {
    groupId: 'Feature.Variants.D',
    context: { userId: '537' },
    weights: [1, 49, 50],
    expected: 'variant3',
  },
  {
    groupId: 'Feature.Variants.override.D',
    context: { userId: '388' },
    weights: [33, 33, 34],
    expected: 'variant2',
  },
  { groupId: 'a', context: { userId: '5' }, weights: [1, 1], expected: 'variant1' },
  { groupId: 'a', context: { userId: '0' }, weights: [1, 1], expected: 'variant2' },
  {
    groupId: 'a',
    context: { clientId: '1' },
    stickiness: 'clientId',
    weights: [1, 1],
    expected: 'variant1',
  },
  {
    groupId: 'a',
    context: { clientId: '2' },
    stickiness: 'clientId',
    weights: [1, 1],
    expected: 'variant2',
  },
]

describe('murmur3', () => {
  it('matches published x86_32 reference vectors', () => {
    expect(murmur3('', 0)).toBe(0)
    expect(murmur3('', 1)).toBe(0x514e28b7)
    expect(murmur3('test', 0)).toBe(0xba6bd213)
    expect(murmur3('Hello, world!', 0x9747b28c)).toBe(0x24884cba)
  })
})

describe('selectVariant', () => {
  it.each(UNLEASH_CASES)(
    'matches Unleash: $groupId $context -> $expected',
    ({ groupId, context, weights, expected, stickiness }) => {
      const variants = weighted(stickiness ?? 'default', ...weights)
      expect(selectVariant(groupId, variants, context)?.name).toBe(expected)
    },
  )

  it('is stable for the same user', () => {
    const variants = [v('a', 500), v('b', 500)]
    const first = selectVariant('flag', variants, { userId: 'u1' })
    expect(selectVariant('flag', variants, { userId: 'u1' })).toEqual(first)
  })

  it('never picks a weight 0 variant', () => {
    const variants = [v('a', 0), v('b', 1000)]
    for (let i = 0; i < 200; i++) {
      expect(selectVariant('flag', variants, { userId: String(i) })?.name).toBe('b')
    }
  })

  it('returns null when there are no variants or total weight is 0', () => {
    expect(selectVariant('flag', [], { userId: 'u' })).toBeNull()
    expect(selectVariant('flag', [v('a', 0)], { userId: 'u' })).toBeNull()
  })

  it('default stickiness prefers userId, then sessionId, then remoteAddress', () => {
    const variants = weighted('default', ...Array<number>(20).fill(50))
    const byUser = selectVariant('flag', variants, { userId: 'u1' })
    expect(selectVariant('flag', variants, { userId: 'u1', sessionId: 's9' })).toEqual(byUser)
    const bySession = selectVariant('flag', variants, { sessionId: 's9' })
    expect(selectVariant('flag', variants, { sessionId: 's9', remoteAddress: '1.1.1.1' })).toEqual(
      bySession,
    )
    expect(selectVariant('flag', variants, { remoteAddress: '1.1.1.1' }, () => 'unused')).toEqual(
      selectVariant('flag', variants, { userId: '1.1.1.1' }),
    )
  })

  it('uses a custom stickiness field', () => {
    const variants = weighted('tenant', ...Array<number>(20).fill(50))
    const first = selectVariant('flag', variants, { tenant: 't1', userId: 'x' })
    expect(selectVariant('flag', variants, { tenant: 't1', userId: 'y' })).toEqual(first)
  })

  it('falls back to the injected random value when the stickiness value is missing', () => {
    const variants = weighted('tenant', ...Array<number>(20).fill(50))
    const withRandom = selectVariant('flag', variants, {}, () => '42')
    expect(selectVariant('flag', variants, { tenant: '42' })).toEqual(withRandom)
  })

  it('random stickiness ignores context', () => {
    const variants = weighted('random', ...Array<number>(20).fill(50))
    const fromRandom = selectVariant('flag', variants, { userId: 'u1' }, () => '7')
    const fromUser = selectVariant('flag', weighted('default', ...Array<number>(20).fill(50)), {
      userId: '7',
    })
    expect(fromRandom?.name).toBe(fromUser?.name)
  })
})
