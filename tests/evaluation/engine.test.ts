import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { evaluateFlag } from '../../src/evaluation/engine.js'

describe('evaluateFlag', () => {
  it('returns false default for disabled flag with no overrides', () => {
    expect(evaluateFlag({ enabled: false, overrides: [] }, {})).toEqual({
      enabled: false,
      reason: 'default'
    })
  })

  it('returns true default for enabled flag with no overrides', () => {
    expect(evaluateFlag({ enabled: true, overrides: [] }, {})).toEqual({
      enabled: true,
      reason: 'default'
    })
  })

  it('allows override to enable globally off flag', () => {
    expect(
      evaluateFlag(
        { enabled: false, overrides: [{ contextKey: 'userId', contextValue: 'user_1', enabled: true }] },
        { userId: 'user_1' }
      )
    ).toEqual({ enabled: true, reason: 'override' })
  })

  it('allows override to disable globally on flag', () => {
    expect(
      evaluateFlag(
        { enabled: true, overrides: [{ contextKey: 'userId', contextValue: 'user_1', enabled: false }] },
        { userId: 'user_1' }
      )
    ).toEqual({ enabled: false, reason: 'override' })
  })

  it('uses first matching override', () => {
    expect(
      evaluateFlag(
        {
          enabled: false,
          overrides: [
            { contextKey: 'userId', contextValue: 'user_1', enabled: true },
            { contextKey: 'userId', contextValue: 'user_1', enabled: false }
          ]
        },
        { userId: 'user_1' }
      )
    ).toEqual({ enabled: true, reason: 'override' })
  })

  it('falls through when context key is not present', () => {
    expect(
      evaluateFlag(
        { enabled: false, overrides: [{ contextKey: 'userId', contextValue: 'user_1', enabled: true }] },
        {}
      )
    ).toEqual({ enabled: false, reason: 'default' })
  })

  it('uses default with an empty overrides array', () => {
    expect(evaluateFlag({ enabled: true, overrides: [] }, { userId: 'user_1' })).toEqual({
      enabled: true,
      reason: 'default'
    })
  })

  it('matches empty string values but not undefined', () => {
    const state = {
      enabled: false,
      overrides: [{ contextKey: 'plan', contextValue: '', enabled: true }]
    }
    expect(evaluateFlag(state, { plan: '' })).toEqual({ enabled: true, reason: 'override' })
    expect(evaluateFlag(state, {})).toEqual({ enabled: false, reason: 'default' })
  })

  it('has zero non-type imports', () => {
    const source = readFileSync('src/evaluation/engine.ts', 'utf8')
    const importLines = source.split('\n').filter((line) => line.trim().startsWith('import '))
    expect(importLines.every((line) => /^import\s+type\b/.test(line.trim()))).toBe(true)
  })
})
