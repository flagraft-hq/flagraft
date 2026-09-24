import { describe, expect, it } from 'vitest'

import { warnIfCrossOrigin } from '../api'

describe('warnIfCrossOrigin', () => {
  it('says nothing when the API is on the page origin', () => {
    expect(warnIfCrossOrigin('https://flags.example.com', 'https://flags.example.com')).toBeNull()
  })

  it('says nothing for a relative API path', () => {
    expect(warnIfCrossOrigin('https://flags.example.com', '/')).toBeNull()
  })

  it('ignores a differing port only when it matches', () => {
    expect(warnIfCrossOrigin('http://localhost:5173', 'http://localhost:5173')).toBeNull()
  })

  it('warns on a different host', () => {
    const warning = warnIfCrossOrigin('https://flags.example.com', 'https://api.example.com')
    expect(warning).toContain('Cross-origin is not supported')
    expect(warning).toContain('https://api.example.com')
  })

  /** The dev server on :5173 talking straight to :3000 is the classic trap. */
  it('warns on a different port', () => {
    expect(warnIfCrossOrigin('http://localhost:5173', 'http://localhost:3000')).toContain(
      'session cookie will be dropped',
    )
  })

  it('warns on a scheme change, which is also a different origin', () => {
    expect(
      warnIfCrossOrigin('https://flags.example.com', 'http://flags.example.com'),
    ).not.toBeNull()
  })

  it('stays quiet when the page origin is unknown, as in a server render', () => {
    expect(warnIfCrossOrigin('', 'https://api.example.com')).toBeNull()
  })
})
