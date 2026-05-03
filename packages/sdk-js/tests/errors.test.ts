import { describe, expect, it } from 'vitest'
import { FlagraftError } from '../src/errors.js'

describe('FlagraftError', () => {
  it('preserves status, code, and message', () => {
    const err = new FlagraftError('Forbidden', 403, 'Forbidden')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('FlagraftError')
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('Forbidden')
    expect(err.message).toBe('Forbidden')
  })
})
