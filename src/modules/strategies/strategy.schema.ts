import { z } from 'zod'

/**
 * Which constraint operators are valid for each context-field type.
 * Shared by write-time validation, the evaluation engine, and the admin UI.
 * `in` / `notIn` take a list of values; every other operator uses values[0].
 */
export const OPERATORS_BY_TYPE = {
  string: ['equals', 'in', 'notIn', 'startsWith', 'contains', 'regex'],
  enum: ['equals', 'in', 'notIn'],
  boolean: ['is'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
  version: ['eq', 'gte', 'lte', 'satisfies'],
  date: ['before', 'after'],
} as const

export const strategyParamsSchema = z.object({
  projectId: z.string().uuid(),
  flagKey: z.string().min(1),
  environmentSlug: z.string().min(1),
})

const constraintSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
})

/** A strategy with no constraints always matches (on for everyone). */
const strategySchema = z.object({
  constraints: z.array(constraintSchema),
})

/** PUT replaces the whole ordered list; position is the array index. */
export const putStrategiesSchema = z.object({
  strategies: z.array(strategySchema),
})

export type ConstraintInput = z.infer<typeof constraintSchema>
export type PutStrategiesInput = z.infer<typeof putStrategiesSchema>
