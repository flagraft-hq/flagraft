import { describe, it, expect } from 'vitest'

import { loginUrlFor, safeNext } from '../nextPath'

describe('loginUrlFor', () => {
  it('encodes the path someone was headed to', () => {
    expect(loginUrlFor('/flags/checkout-v2')).toBe('/login?next=%2Fflags%2Fcheckout-v2')
  })

  it('keeps the query string of the target', () => {
    expect(loginUrlFor('/flags', '?state=on')).toBe('/login?next=%2Fflags%3Fstate%3Don')
  })

  it('returns a plain /login when there is nothing to return to', () => {
    expect(loginUrlFor('/')).toBe('/login')
    expect(loginUrlFor('/login')).toBe('/login')
  })
})

describe('safeNext', () => {
  it('returns the requested in-app path', () => {
    expect(safeNext('?next=%2Fkeys')).toBe('/keys')
  })

  it('falls back when next is missing', () => {
    expect(safeNext('')).toBe('/flags')
    expect(safeNext('?other=1')).toBe('/flags')
  })

  it('honours a custom fallback', () => {
    expect(safeNext('', '/users')).toBe('/users')
  })

  it.each([
    ['an absolute URL', '?next=https%3A%2F%2Fevil.com'],
    ['a protocol-relative URL', '?next=%2F%2Fevil.com'],
    ['a backslash protocol-relative URL', '?next=%2F%5Cevil.com'],
    ['a javascript: URL', '?next=javascript%3Aalert(1)'],
    ['a bare word', '?next=evil.com'],
  ])('rejects %s', (_label, search) => {
    expect(safeNext(search)).toBe('/flags')
  })
})
