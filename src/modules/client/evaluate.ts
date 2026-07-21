import type { StrategyConstraint } from '../../db/schema.js'

export interface StrategyDef {
  constraints: StrategyConstraint[]
}

export interface FlagState {
  enabled: boolean
  strategies: StrategyDef[]
}

export type EvalReason = 'disabled' | 'strategy-match' | 'default'
export type EvalContext = Record<string, string>
export type FieldTypes = Record<string, string>

/** 'true' (any case) is true; everything else is false. */
function toBool(value: string): boolean {
  return value.trim().toLowerCase() === 'true'
}

function safeRegexTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value)
  } catch {
    return false
  }
}

/** Parses "1.2.3" (ignoring any -prerelease/+build) into a padded [major,minor,patch]. */
function parseVersion(v: string): [number, number, number] | null {
  const core = v.trim().split('+')[0].split('-')[0]
  const parts = core.split('.')
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n))) return null
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0]
}

function compareTuple(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

/** Returns -1/0/1, or null if either version is unparseable. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  return compareTuple(pa, pb)
}

/** Supports ^, ~, >=, <=, >, <, = and bare-exact ranges. */
export function versionSatisfies(version: string, range: string): boolean {
  const ver = parseVersion(version)
  if (!ver) return false
  const m = range.trim().match(/^(\^|~|>=|<=|>|<|=)?\s*(.+)$/)
  if (!m) return false
  const op = m[1]
  const base = parseVersion(m[2])
  if (!base) return false

  if (op === '^') {
    let upper: [number, number, number]
    if (base[0] > 0) upper = [base[0] + 1, 0, 0]
    else if (base[1] > 0) upper = [0, base[1] + 1, 0]
    else upper = [0, 0, base[2] + 1]
    return compareTuple(ver, base) >= 0 && compareTuple(ver, upper) < 0
  }
  if (op === '~') {
    const upper: [number, number, number] = [base[0], base[1] + 1, 0]
    return compareTuple(ver, base) >= 0 && compareTuple(ver, upper) < 0
  }

  const cmp = compareTuple(ver, base)
  switch (op) {
    case '>=':
      return cmp >= 0
    case '<=':
      return cmp <= 0
    case '>':
      return cmp > 0
    case '<':
      return cmp < 0
    default:
      return cmp === 0
  }
}

/**
 * Tests one constraint against the context. A missing context value never
 * matches (fail-closed), which is what gives "off when a targeted field is
 * absent" for free.
 */
export function matchConstraint(
  c: StrategyConstraint,
  fieldType: string | undefined,
  ctxValue: string | undefined,
): boolean {
  if (ctxValue === undefined) return false
  if (fieldType === undefined) return false
  const first = c.values[0] ?? ''

  switch (fieldType) {
    case 'boolean':
      return c.operator === 'is' && toBool(ctxValue) === toBool(first)

    case 'number': {
      const n = Number(ctxValue)
      const m = Number(first)
      if (Number.isNaN(n) || Number.isNaN(m)) return false
      switch (c.operator) {
        case 'eq':
          return n === m
        case 'neq':
          return n !== m
        case 'lt':
          return n < m
        case 'lte':
          return n <= m
        case 'gt':
          return n > m
        case 'gte':
          return n >= m
        default:
          return false
      }
    }

    case 'version': {
      if (c.operator === 'satisfies') return versionSatisfies(ctxValue, first)
      const cmp = compareVersions(ctxValue, first)
      if (cmp === null) return false
      switch (c.operator) {
        case 'eq':
          return cmp === 0
        case 'gte':
          return cmp >= 0
        case 'lte':
          return cmp <= 0
        default:
          return false
      }
    }

    case 'date': {
      const t = Date.parse(ctxValue)
      const u = Date.parse(first)
      if (Number.isNaN(t) || Number.isNaN(u)) return false
      if (c.operator === 'before') return t < u
      if (c.operator === 'after') return t > u
      return false
    }

    // string and enum
    default:
      switch (c.operator) {
        case 'equals':
          return ctxValue === first
        case 'in':
          return c.values.includes(ctxValue)
        case 'notIn':
          return !c.values.includes(ctxValue)
        case 'startsWith':
          return ctxValue.startsWith(first)
        case 'contains':
          return ctxValue.includes(first)
        case 'regex':
          return safeRegexTest(first, ctxValue)
        default:
          return false
      }
  }
}

/** A strategy matches when all its constraints match (AND). No constraints = always matches. */
function strategyMatches(
  strategy: StrategyDef,
  fieldTypes: FieldTypes,
  context: EvalContext,
): boolean {
  return strategy.constraints.every((c) =>
    matchConstraint(c, fieldTypes[c.fieldKey], context[c.fieldKey]),
  )
}

/**
 * Unleash-style evaluation: disabled env → off; enabled with no strategies →
 * on for all; enabled with strategies → on if any strategy matches, else off.
 */
export function evaluateFlag(
  state: FlagState,
  fieldTypes: FieldTypes,
  context: EvalContext,
): { enabled: boolean; reason: EvalReason } {
  if (!state.enabled) return { enabled: false, reason: 'disabled' }
  if (state.strategies.length === 0) return { enabled: true, reason: 'default' }
  for (const strategy of state.strategies) {
    if (strategyMatches(strategy, fieldTypes, context)) {
      return { enabled: true, reason: 'strategy-match' }
    }
  }
  return { enabled: false, reason: 'default' }
}
