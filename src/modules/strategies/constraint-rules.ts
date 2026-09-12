import { OPERATORS_BY_TYPE } from './strategy.schema.js'

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

  if (field.type === 'enum' && field.enumValues) {
    for (const value of constraint.values) {
      if (!field.enumValues.includes(value)) {
        return `Value "${value}" is not an allowed value for "${field.key}"`
      }
    }
  }

  return null
}
