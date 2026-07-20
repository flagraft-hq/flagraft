import type { FieldType } from './types'

/**
 * Operators offered per field type, mirroring the server's OPERATORS_BY_TYPE.
 * `label` is what the editor shows; `value` is what the API stores.
 */
export const OPERATORS_BY_TYPE: Record<FieldType, { value: string; label: string }[]> = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'in', label: 'in' },
    { value: 'notIn', label: 'not in' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'contains', label: 'contains' },
    { value: 'regex', label: 'matches regex' },
  ],
  enum: [
    { value: 'equals', label: 'equals' },
    { value: 'in', label: 'in' },
    { value: 'notIn', label: 'not in' },
  ],
  boolean: [{ value: 'is', label: 'is' }],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
  ],
  version: [
    { value: 'eq', label: '=' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'satisfies', label: 'satisfies' },
  ],
  date: [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
  ],
}

/** True when the operator takes a list of values (comma-separated in the UI). */
export function isMultiValueOperator(operator: string): boolean {
  return operator === 'in' || operator === 'notIn'
}
