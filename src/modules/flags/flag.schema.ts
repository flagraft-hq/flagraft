import { z } from 'zod'

export const flagParamsSchema = z.object({
  projectId: z.string().uuid(),
  flagKey: z.string().min(1),
})

export const flagEnvironmentParamsSchema = flagParamsSchema.extend({
  environmentSlug: z.string().min(1),
})

/** Hard ceiling on page size so a caller cannot ask for the whole table. */
export const MAX_PAGE_SIZE = 100

export const listFlagsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  /** Matched against name, key and description. */
  search: z.string().trim().min(1).optional(),
  /** Filters on the flag's on/off state within `env`; ignored without it. */
  state: z.enum(['on', 'off']).optional(),
  env: z.string().min(1).optional(),
  sort: z.enum(['name', 'key', 'updated']).default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

export type ListFlagsQuery = z.infer<typeof listFlagsQuerySchema>

export const createFlagSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
})

export const patchFlagSchema = createFlagSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export type CreateFlagInput = z.infer<typeof createFlagSchema>
export type PatchFlagInput = z.infer<typeof patchFlagSchema>
