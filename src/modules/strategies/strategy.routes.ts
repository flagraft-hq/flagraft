import type { FastifyInstance } from 'fastify'

import { cacheKeys } from '../../cache/keys.js'
import { putStrategiesSchema, strategyParamsSchema } from './strategy.schema.js'
import * as service from './strategy.service.js'

const strategiesPath =
  '/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/strategies'

const paramsJsonSchema = {
  type: 'object',
  properties: {
    projectId: { type: 'string' },
    flagKey: { type: 'string' },
    environmentSlug: { type: 'string' },
  },
  required: ['projectId', 'flagKey', 'environmentSlug'],
} as const

export async function strategyRoutes(fastify: FastifyInstance) {
  fastify.get(
    strategiesPath,
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List targeting strategies for a flag in an environment (ordered).',
        params: paramsJsonSchema,
      },
    },
    async (request) => {
      const params = strategyParamsSchema.parse(request.params)
      return service.listStrategies(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
      )
    },
  )

  fastify.put(
    strategiesPath,
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description:
          'Replace the whole ordered list of targeting strategies for a flag in an environment.',
        params: paramsJsonSchema,
      },
    },
    async (request) => {
      const params = strategyParamsSchema.parse(request.params)
      const result = await service.replaceStrategies(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
        putStrategiesSchema.parse(request.body),
      )
      await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(params.projectId))
      return result
    },
  )
}
