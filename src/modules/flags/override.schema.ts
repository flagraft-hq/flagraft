import { z } from 'zod'

export const overrideParamsSchema = z.object({
  projectId: z.string().uuid(),
  flagKey: z.string().min(1),
  environmentSlug: z.string().min(1)
})

export const deleteOverrideParamsSchema = overrideParamsSchema.extend({
  overrideId: z.string().uuid()
})

export const createOverrideSchema = z.object({
  contextKey: z.string().min(1),
  contextValue: z.string(),
  enabled: z.boolean()
})

export type CreateOverrideInput = z.infer<typeof createOverrideSchema>
