import { z } from 'zod'

import { API_KEY_TYPES } from '../../auth/constants.js'
import { MAX_PAGE_SIZE } from '../../limits.js'

export const keyProjectParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const keyParamsSchema = keyProjectParamsSchema.extend({
  keyId: z.string().uuid(),
})

export const listKeysQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  /** Matched against the label and the key prefix. */
  search: z.string().trim().min(1).optional(),
  type: z.enum([API_KEY_TYPES.CLIENT, API_KEY_TYPES.ADMIN]).optional(),
  environmentId: z.string().uuid().optional(),
  sort: z.enum(['created', 'lastUsed', 'label']).default('created'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

export type ListKeysQuery = z.infer<typeof listKeysQuerySchema>

export const createKeySchema = z.object({
  type: z.enum([API_KEY_TYPES.CLIENT, API_KEY_TYPES.ADMIN]),
  environmentId: z.string().uuid().optional(),
  description: z.string().optional(),
})

export type CreateKeyInput = z.infer<typeof createKeySchema>
