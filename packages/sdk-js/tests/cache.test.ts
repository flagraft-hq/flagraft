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

describe('TtlCache size cap', () => {
  it('never grows past maxEntries', () => {
    const cache = new TtlCache<number>(30, 0, 3)
    for (let i = 0; i < 100; i++) cache.set(`k${i}`, i)
    expect(cache.size).toBe(3)
  })

  it('drops the oldest entry first', () => {
    const cache = new TtlCache<number>(30, 0, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('treats a refreshed key as the newest again', () => {
    const cache = new TtlCache<number>(30, 0, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 11)
    cache.set('c', 3)
    /** 'b' is now the oldest write, so 'a' survives. */
    expect(cache.get('a')).toBe(11)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })
})

describe('TtlCache stale window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getStale returns an expired value inside the stale window', () => {
    const cache = new TtlCache<number>(30, 300)
    cache.set('k', 1)
    vi.advanceTimersByTime(31_000)
    expect(cache.get('k')).toBeUndefined()
    expect(cache.getStale('k')).toMatchObject({ value: 1 })
  })

  it('reports when the stale value was stored', () => {
    const cache = new TtlCache<number>(30, 300)
    const storedAt = Date.now()
    cache.set('k', 1)
    vi.advanceTimersByTime(60_000)
    expect(cache.getStale('k')?.storedAt).toBe(storedAt)
  })

  it('getStale ignores a value that is still fresh', () => {
    const cache = new TtlCache<number>(30, 300)
    cache.set('k', 1)
    expect(cache.getStale('k')).toBeUndefined()
  })

  it('drops the value once the stale window closes', () => {
    const cache = new TtlCache<number>(30, 300)
    cache.set('k', 1)
    vi.advanceTimersByTime(331_000)
    expect(cache.getStale('k')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('keeps no stale value when staleTtl is 0', () => {
    const cache = new TtlCache<number>(30, 0)
    cache.set('k', 1)
    vi.advanceTimersByTime(31_000)
    expect(cache.getStale('k')).toBeUndefined()
  })
})
