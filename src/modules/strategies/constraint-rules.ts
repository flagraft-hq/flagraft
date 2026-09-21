import safeRegex from 'safe-regex'

import { OPERATORS_BY_TYPE } from './strategy.schema.js'

/**
 * Checks a regex constraint before it is stored. Evaluation runs the pattern
 * against caller-supplied context on every request, so a pattern that
 * backtracks exponentially -- `(a+)+$` and friends -- would hang the server
 * for everyone. Rejecting it here means the admin who wrote it sees the
 * problem, instead of it surfacing as an outage later.
 */
function regexError(pattern: string): string | null {
  try {
    new RegExp(pattern)
  } catch {
    return `"${pattern}" is not a valid regular expression`
  }

  if (!safeRegex(pattern)) {
    return `"${pattern}" can hang flag evaluation on some inputs. Rewrite it without nested quantifiers, such as a repeated group that itself repeats.`
  }

  return null
}

export interface FieldRule {
  key: string
  type: string
  enumValues: string[] | null
}

export interface ConstraintLike {
  fieldKey: string
  operator: string
  values: string[]
}

/**
 * Decides whether one constraint is legal against the project's context
 * fields, and says why when it is not.
 *
 * Returns null when the constraint is fine. Callers choose what to do with a
 * reason: the strategy endpoint turns it into a 400, and the flag importer
 * drops the strategy and puts the reason in its report. Keeping the rule in
 * one place is what stops those two from drifting apart.
 */
export function constraintError(
  fields: Map<string, FieldRule>,
  constraint: ConstraintLike,
): string | null {
  const field = fields.get(constraint.fieldKey)
  if (!field) {
    return `Unknown context field: "${constraint.fieldKey}"`
  }

  const allowed = (OPERATORS_BY_TYPE as Record<string, readonly string[]>)[field.type] ?? []
  if (!allowed.includes(constraint.operator)) {
    return `Operator "${constraint.operator}" is not valid for ${field.type} field "${field.key}"`
  }

  if (constraint.operator === 'regex') {
    const error = regexError(constraint.values[0] ?? '')
    if (error) return error
  }

  if (field.type === 'enum' && field.enumValues) {
    for (const value of constraint.values) {
      if (!field.enumValues.includes(value)) {
        return `Value "${value}" is not an allowed value for "${field.key}"`
      }
    }
  }

  return null
}
