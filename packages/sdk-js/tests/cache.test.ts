import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TtlCache, makeKey } from '../src/cache.js'

describe('makeKey', () => {
  it('produces a stable key regardless of context property order', () => {
    const a = makeKey('flag-1', { userId: 'u1', sessionId: 's2' })
    const b = makeKey('flag-1', { sessionId: 's2', userId: 'u1' })
    expect(a).toBe(b)
  })

  it('differentiates flag keys', () => {
    expect(makeKey('a', {})).not.toBe(makeKey('b', {}))
  })
})

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns set values within ttl', () => {
    const cache = new TtlCache<number>(30)
    cache.set('k', 1)
    expect(cache.get('k')).toBe(1)
  })

  it('returns undefined after ttl expires', () => {
    const cache = new TtlCache<number>(1)
    cache.set('k', 1)
    vi.advanceTimersByTime(1500)
    expect(cache.get('k')).toBeUndefined()
  })

  it('treats ttl=0 as disabled (set is a no-op)', () => {
    const cache = new TtlCache<number>(0)
    cache.set('k', 1)
    expect(cache.get('k')).toBeUndefined()
  })

  it('clear removes all entries', () => {
    const cache = new TtlCache<number>(30)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })
})
