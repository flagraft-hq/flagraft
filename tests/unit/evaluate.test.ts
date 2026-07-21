import { describe, expect, it } from 'vitest'

import { evaluateFlag, matchConstraint } from '../../src/modules/client/evaluate.js'
import type { FlagState } from '../../src/modules/client/evaluate.js'

const c = (fieldKey: string, operator: string, ...values: string[]) => ({
  fieldKey,
  operator,
  values,
})

describe('matchConstraint', () => {
  it('missing context value never matches (fail-closed)', () => {
    expect(matchConstraint(c('tenant', 'in', 'phyg'), 'string', undefined)).toBe(false)
    expect(matchConstraint(c('tenant', 'notIn', 'phyg'), 'string', undefined)).toBe(false)
  })

  it('unregistered/deleted field (undefined type) never matches (fail-closed)', () => {
    expect(matchConstraint(c('tenant', 'in', 'phyg'), undefined, 'phyg')).toBe(false)
    expect(matchConstraint(c('tenant', 'equals', 'phyg'), undefined, 'phyg')).toBe(false)
    expect(matchConstraint(c('tenant', 'notIn', 'other'), undefined, 'phyg')).toBe(false)
  })

  it('string / enum operators', () => {
    expect(matchConstraint(c('t', 'equals', 'phyg'), 'string', 'phyg')).toBe(true)
    expect(matchConstraint(c('t', 'equals', 'phyg'), 'string', 'acme')).toBe(false)
    expect(matchConstraint(c('t', 'in', 'a', 'b'), 'string', 'b')).toBe(true)
    expect(matchConstraint(c('t', 'notIn', 'a', 'b'), 'string', 'c')).toBe(true)
    expect(matchConstraint(c('t', 'notIn', 'a', 'b'), 'string', 'a')).toBe(false)
    expect(matchConstraint(c('t', 'startsWith', 'ph'), 'string', 'phyg')).toBe(true)
    expect(matchConstraint(c('t', 'contains', 'hy'), 'string', 'phyg')).toBe(true)
    expect(matchConstraint(c('t', 'regex', '^ph.*g$'), 'string', 'phyg')).toBe(true)
    expect(matchConstraint(c('t', 'regex', '('), 'string', 'phyg')).toBe(false) // invalid regex
  })

  it('boolean', () => {
    expect(matchConstraint(c('b', 'is', 'true'), 'boolean', 'true')).toBe(true)
    expect(matchConstraint(c('b', 'is', 'true'), 'boolean', 'false')).toBe(false)
    expect(matchConstraint(c('b', 'is', 'false'), 'boolean', 'FALSE')).toBe(true)
  })

  it('number', () => {
    expect(matchConstraint(c('n', 'gt', '10'), 'number', '11')).toBe(true)
    expect(matchConstraint(c('n', 'gte', '10'), 'number', '10')).toBe(true)
    expect(matchConstraint(c('n', 'lt', '10'), 'number', '9')).toBe(true)
    expect(matchConstraint(c('n', 'eq', '10'), 'number', '10')).toBe(true)
    expect(matchConstraint(c('n', 'neq', '10'), 'number', '11')).toBe(true)
    expect(matchConstraint(c('n', 'gt', '10'), 'number', 'abc')).toBe(false)
  })

  it('version compare and satisfies', () => {
    expect(matchConstraint(c('v', 'gte', '1.2.0'), 'version', '1.2.3')).toBe(true)
    expect(matchConstraint(c('v', 'lte', '1.2.0'), 'version', '1.3.0')).toBe(false)
    expect(matchConstraint(c('v', 'eq', '1.2.3'), 'version', '1.2.3')).toBe(true)
    expect(matchConstraint(c('v', 'satisfies', '^1.2.0'), 'version', '1.9.9')).toBe(true)
    expect(matchConstraint(c('v', 'satisfies', '^1.2.0'), 'version', '2.0.0')).toBe(false)
    expect(matchConstraint(c('v', 'satisfies', '~1.2.0'), 'version', '1.2.9')).toBe(true)
    expect(matchConstraint(c('v', 'satisfies', '~1.2.0'), 'version', '1.3.0')).toBe(false)
    expect(matchConstraint(c('v', 'satisfies', '>=1.2.0'), 'version', '1.2.0')).toBe(true)
    expect(matchConstraint(c('v', 'eq', 'nope'), 'version', '1.2.3')).toBe(false)
  })

  it('date before / after', () => {
    expect(matchConstraint(c('d', 'after', '2026-01-01'), 'date', '2026-06-01')).toBe(true)
    expect(matchConstraint(c('d', 'before', '2026-01-01'), 'date', '2025-06-01')).toBe(true)
    expect(matchConstraint(c('d', 'after', '2026-01-01'), 'date', 'not-a-date')).toBe(false)
  })
})

describe('evaluateFlag', () => {
  const strat = (...constraints: ReturnType<typeof c>[]) => ({ constraints })
  const types = { tenant: 'string', plan: 'enum' }

  it('disabled env is off with reason disabled', () => {
    const state: FlagState = { enabled: false, strategies: [strat(c('tenant', 'in', 'phyg'))] }
    expect(evaluateFlag(state, types, { tenant: 'phyg' })).toEqual({
      enabled: false,
      reason: 'disabled',
    })
  })

  it('enabled with no strategies is on for everyone', () => {
    const state: FlagState = { enabled: true, strategies: [] }
    expect(evaluateFlag(state, types, {})).toEqual({ enabled: true, reason: 'default' })
  })

  it('on when a strategy matches', () => {
    const state: FlagState = { enabled: true, strategies: [strat(c('tenant', 'in', 'phyg'))] }
    expect(evaluateFlag(state, types, { tenant: 'phyg' })).toEqual({
      enabled: true,
      reason: 'strategy-match',
    })
  })

  it('a strategy referencing an unregistered field fails closed', () => {
    // `tenant` is not in the field-type map (e.g. deleted after the strategy was saved)
    const state: FlagState = { enabled: true, strategies: [strat(c('tenant', 'in', 'phyg'))] }
    expect(evaluateFlag(state, { plan: 'enum' }, { tenant: 'phyg' })).toEqual({
      enabled: false,
      reason: 'default',
    })
  })

  it('off (default) when no strategy matches', () => {
    const state: FlagState = { enabled: true, strategies: [strat(c('tenant', 'in', 'phyg'))] }
    expect(evaluateFlag(state, types, { tenant: 'acme' })).toEqual({
      enabled: false,
      reason: 'default',
    })
  })

  it('AND within a strategy: all constraints must match', () => {
    const state: FlagState = {
      enabled: true,
      strategies: [strat(c('tenant', 'in', 'phyg'), c('plan', 'equals', 'pro'))],
    }
    expect(evaluateFlag(state, types, { tenant: 'phyg', plan: 'pro' }).enabled).toBe(true)
    expect(evaluateFlag(state, types, { tenant: 'phyg', plan: 'free' }).enabled).toBe(false)
  })

  it('OR across strategies: any strategy matching wins', () => {
    const state: FlagState = {
      enabled: true,
      strategies: [strat(c('tenant', 'in', 'phyg')), strat(c('plan', 'equals', 'pro'))],
    }
    expect(evaluateFlag(state, types, { plan: 'pro' }).enabled).toBe(true)
    expect(evaluateFlag(state, types, { tenant: 'x', plan: 'free' }).enabled).toBe(false)
  })
})
