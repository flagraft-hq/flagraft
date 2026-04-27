import { z } from 'zod'

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
})

export const patchProjectSchema = createProjectSchema.partial().refine((value) => {
  return Object.keys(value).length > 0
}, 'At least one field is required')

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type PatchProjectInput = z.infer<typeof patchProjectSchema>
