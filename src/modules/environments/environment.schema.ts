import { z } from 'zod'

export const environmentParamsSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
})

export const projectEnvironmentParamsSchema = environmentParamsSchema.pick({ projectId: true })

export const createEnvironmentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  protected: z.boolean().optional(),
})

export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>

/** Slug is immutable, so only name and protected can be patched. */
export const updateEnvironmentSchema = z
  .object({
    name: z.string().min(1),
    protected: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>
