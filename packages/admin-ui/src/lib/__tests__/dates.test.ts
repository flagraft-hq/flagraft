import { describe, it, expect } from 'vitest'
import { formatDate } from '../dates'

describe('formatDate', () => {
  it('formats what the API returns', () => {
    /** Locale-independent: assert the parts, not one locale's ordering. */
    const formatted = formatDate('2026-01-14T09:12:33.412Z')
    expect(formatted).toMatch(/Jan/)
    expect(formatted).toMatch(/14/)
    expect(formatted).toMatch(/2026/)
  })

  it('accepts a date-only value and the space-separated form', () => {
    expect(formatDate('2026-01-14')).toMatch(/Jan/)
    expect(formatDate('2026-01-14 09:12')).toMatch(/Jan/)
  })

  it('never renders Invalid Date', () => {
    expect(formatDate('not a date')).toBe('—')
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})
