import { z } from 'zod'

import { API_KEY_TYPES } from '../../auth/constants.js'

export const keyProjectParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const keyParamsSchema = keyProjectParamsSchema.extend({
  keyId: z.string().uuid(),
})

export const createKeySchema = z.object({
  type: z.enum([API_KEY_TYPES.CLIENT, API_KEY_TYPES.ADMIN]),
  environmentId: z.string().uuid().optional(),
  description: z.string().optional(),
})

export type CreateKeyInput = z.infer<typeof createKeySchema>
