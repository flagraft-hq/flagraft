import { z } from 'zod'

export const keyProjectParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const keyParamsSchema = keyProjectParamsSchema.extend({
  keyId: z.string().uuid(),
})

export const createKeySchema = z.object({
  type: z.enum(['client', 'admin']),
  environmentId: z.string().uuid().optional(),
  description: z.string().optional(),
})

export type CreateKeyInput = z.infer<typeof createKeySchema>
