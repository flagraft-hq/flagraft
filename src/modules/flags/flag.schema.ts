import { z } from 'zod'

export const flagParamsSchema = z.object({
  projectId: z.string().uuid(),
  flagKey: z.string().min(1)
})

export const flagEnvironmentParamsSchema = flagParamsSchema.extend({
  environmentSlug: z.string().min(1)
})

export const createFlagSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional()
})

export const patchFlagSchema = createFlagSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export type CreateFlagInput = z.infer<typeof createFlagSchema>
export type PatchFlagInput = z.infer<typeof patchFlagSchema>
