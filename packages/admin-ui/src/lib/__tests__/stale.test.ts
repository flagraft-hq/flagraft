import { describe, it, expect } from 'vitest'
import { isFlagStale } from '../stale'

const NOW = new Date('2026-07-23T12:00:00.000Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('isFlagStale', () => {
  it('is stale when older than the window', () => {
    expect(isFlagStale(daysAgo(45), 30, NOW)).toBe(true)
  })

  it('is not stale when within the window', () => {
    expect(isFlagStale(daysAgo(10), 30, NOW)).toBe(false)
  })

  it('is never stale when the window is null (Never)', () => {
    expect(isFlagStale(daysAgo(500), null, NOW)).toBe(false)
    expect(isFlagStale(daysAgo(500), undefined, NOW)).toBe(false)
  })

  it('handles a missing or invalid date safely', () => {
    expect(isFlagStale(undefined, 30, NOW)).toBe(false)
    expect(isFlagStale('not-a-date', 30, NOW)).toBe(false)
  })

  it('treats exactly-at-the-boundary as not yet stale', () => {
    expect(isFlagStale(daysAgo(30), 30, NOW)).toBe(false)
  })
})
