import type { Override, ContextField, FieldType } from './types'
import { OPS_BY_TYPE } from './types'

/**
 * Validates if the operator is valid for the given field type.
 * Returns error message or null.
 */
export function validateOperator(op: string, fieldType: FieldType): string | null {
  if (!op) {
    return 'Operator is required'
  }
  const allowed = OPS_BY_TYPE[fieldType]
  if (!allowed || !allowed.some((o) => o.value === op)) {
    return 'Invalid operator for this field type'
  }
  return null
}

/**
 * Validates the value string for a given field type and operator.
 * Returns error message or null.
 */
export function validateValue(
  val: string,
  fieldType: FieldType,
  op: string,
  field?: ContextField,
): string | null {
  if (!val) {
    return 'Value is required'
  }

  if (fieldType === 'boolean') {
    if (val !== 'true' && val !== 'false') {
      return 'Must be true or false'
    }
    return null
  }

  if (fieldType === 'enum') {
    if (op === 'equals') {
      if (field?.enumValues && !field.enumValues.includes(val)) {
        return 'Invalid enum value'
      }
    } else if (op === 'in') {
      if (field?.enumValues) {
        const parts = val.split(',').map((v) => v.trim())
        for (const part of parts) {
          if (!field.enumValues.includes(part)) {
            return `Invalid enum value: ${part}`
          }
        }
      }
    }
    return null
  }

  if (fieldType === 'number') {
    if (isNaN(Number(val))) {
      return 'Must be a valid number'
    }
    return null
  }

  if (fieldType === 'version') {
    if (op !== 'satisfies') {
      const semverPattern = /^\d+\.\d+\.\d+$/
      if (!semverPattern.test(val)) {
        return 'Must be a valid semver (e.g. 1.2.3)'
      }
    }
    return null
  }

  return null
}

/**
 * Checks if a new override (by key+op+val+env) would be an exact duplicate of an existing one.
 */
export function isDuplicate(
  pending: Pick<Override, 'key' | 'op' | 'val' | 'env'>,
  existing: Override[],
  excludeId?: string,
): boolean {
  return existing.some(
    (o) =>
      o.id !== excludeId &&
      o.key === pending.key &&
      o.op === pending.op &&
      o.val === pending.val &&
      o.env === pending.env,
  )
}

export interface OverrideValidationErrors {
  key?: string
  op?: string
  val?: string
}

/**
 * Full override form validation. Returns a map of field -> error message (empty = valid).
 */
export function validateOverrideForm(
  data: Pick<Override, 'key' | 'op' | 'val' | 'env'>,
  existingOverrides: Override[],
  contextFields: ContextField[],
  excludeId?: string,
): OverrideValidationErrors {
  const errors: OverrideValidationErrors = {}

  if (!data.key) {
    errors.key = 'Context key is required'
  }

  const field = contextFields.find((f) => f.key === data.key)
  const fieldType: FieldType = field?.type ?? 'string'

  const opError = validateOperator(data.op, fieldType)
  if (opError) {
    errors.op = opError
  }

  const valError = validateValue(data.val, fieldType, data.op, field)
  if (valError) {
    errors.val = valError
  }

  if (!errors.val && isDuplicate(data, existingOverrides, excludeId)) {
    errors.val = 'An identical override already exists'
  }

  return errors
}
