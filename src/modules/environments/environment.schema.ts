import { z } from 'zod'

export const environmentParamsSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
})

export const projectEnvironmentParamsSchema = environmentParamsSchema.pick({ projectId: true })

export const createEnvironmentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>
