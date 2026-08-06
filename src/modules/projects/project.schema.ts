import { z } from 'zod'

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
})

/** Validated shape of the project settings bag (see ProjectSettings in schema). */
export const projectSettingsSchema = z.object({
  flagDefaults: z
    .object({
      defaultState: z.enum(['off', 'dev', 'on']).optional(),
      staleFlagDays: z.number().int().positive().nullable().optional(),
      requireDescription: z.boolean().optional(),
    })
    .optional(),
  security: z
    .object({
      requireApprovalInProd: z.boolean().optional(),
      keyTtlDays: z.number().int().positive().nullable().optional(),
    })
    .optional(),
})

export const patchProjectSchema = createProjectSchema
  .partial()
  .extend({ settings: projectSettingsSchema.optional() })
  .refine((value) => {
    return Object.keys(value).length > 0
  }, 'At least one field is required')

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type PatchProjectInput = z.infer<typeof patchProjectSchema>
