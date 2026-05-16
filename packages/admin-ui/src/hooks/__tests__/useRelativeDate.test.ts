import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRelativeDate } from '../useRelativeDate'

// Mock "now" as 2026-05-15 12:00:00 UTC
const NOW = new Date('2026-05-15T12:00:00.000Z').getTime()

afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
}

describe('useRelativeDate', () => {
  it('returns a dash for undefined input', () => {
    setup()
    expect(useRelativeDate(undefined)).toBe('—')
  })

  it('returns a dash for empty string input', () => {
    setup()
    expect(useRelativeDate('')).toBe('—')
  })

  it('returns "just now" for a date less than 1 minute ago', () => {
    setup()
    // Use same-minute timestamp (truncated to HH:mm) so diffSeconds < 60
    const nowDate = new Date(NOW)
    const dateStr = nowDate.toISOString().slice(0, 16).replace('T', ' ')
    expect(useRelativeDate(dateStr)).toBe('just now')
  })

  it('returns "X min ago" for a date less than 1 hour ago', () => {
    setup()
    const fiveMinutesAgo = new Date(NOW - 5 * 60 * 1000)
    const dateStr = fiveMinutesAgo.toISOString().slice(0, 16).replace('T', ' ')
    expect(useRelativeDate(dateStr)).toBe('5 min ago')
  })

  it('returns "X hours ago" for a date less than 24 hours ago', () => {
    setup()
    const threeHoursAgo = new Date(NOW - 3 * 60 * 60 * 1000)
    const dateStr = threeHoursAgo.toISOString().slice(0, 16).replace('T', ' ')
    expect(useRelativeDate(dateStr)).toBe('3 hours ago')
  })

  it('returns "X days ago" for a date less than 7 days ago', () => {
    setup()
    const twoDaysAgo = new Date(NOW - 2 * 24 * 60 * 60 * 1000)
    const dateStr = twoDaysAgo.toISOString().slice(0, 16).replace('T', ' ')
    expect(useRelativeDate(dateStr)).toBe('2 days ago')
  })

  it('returns formatted date (e.g. "May 2") for dates 7 or more days ago', () => {
    setup()
    // May 2, 2026 is 13 days before May 15
    expect(useRelativeDate('2026-05-02')).toBe('May 2')
  })

  it('returns formatted date for dates in a different month', () => {
    setup()
    // Apr 30, 2026 is 15 days before May 15
    expect(useRelativeDate('2026-04-30')).toBe('Apr 30')
  })
})
