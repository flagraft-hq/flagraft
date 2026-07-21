import { z } from 'zod'

export const FIELD_TYPES = ['string', 'enum', 'boolean', 'number', 'version', 'date'] as const

export const contextFieldParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const contextFieldIdParamsSchema = contextFieldParamsSchema.extend({
  fieldId: z.string().uuid(),
})

const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_.-]*$/,
    'Key must start with a letter or underscore and may contain only letters, numbers, dots, hyphens, and underscores',
  )

/**
 * Optional fields shared by create and update. `enumValues` is validated
 * against `type` by the refinement below, not here.
 */
const optionalFields = {
  description: z.string().optional(),
  enumValues: z.array(z.string().min(1)).optional(),
}

/**
 * `enumValues` must be a non-empty array when `type` is 'enum', and must be
 * omitted for every other type.
 */
function refineEnumValues(
  data: { type: string; enumValues?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (data.type === 'enum') {
    if (!data.enumValues || data.enumValues.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumValues'],
        message: 'enumValues is required and must be non-empty when type is "enum"',
      })
    }
  } else if (data.enumValues !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enumValues'],
      message: 'enumValues is only allowed when type is "enum"',
    })
  }
}

export const createContextFieldSchema = z
  .object({ key: keySchema, type: z.enum(FIELD_TYPES).default('string'), ...optionalFields })
  .superRefine(refineEnumValues)

/**
 * Update replaces every mutable field (`key` is immutable). `type` is
 * REQUIRED here — no default — so a partial PATCH can never silently reset an
 * enum/number/date field to `string` and drop its `enumValues`.
 */
export const updateContextFieldSchema = z
  .object({ type: z.enum(FIELD_TYPES), ...optionalFields })
  .superRefine(refineEnumValues)

export type CreateContextFieldInput = z.infer<typeof createContextFieldSchema>
export type UpdateContextFieldInput = z.infer<typeof updateContextFieldSchema>
