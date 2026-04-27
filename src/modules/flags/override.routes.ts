import type { FastifyInstance } from 'fastify'

import {
  createOverrideSchema,
  deleteOverrideParamsSchema,
  overrideParamsSchema,
} from './override.schema.js'
import * as service from './override.service.js'

export async function overrideRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides',
    { preHandler: fastify.requireAdminKey },
    async (request, reply) => {
      const params = overrideParamsSchema.parse(request.params)
      const override = await service.createOverride(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
        createOverrideSchema.parse(request.body),
      )
      return reply.status(201).send(override)
    },
  )

  fastify.get(
    '/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = overrideParamsSchema.parse(request.params)
      return service.listOverrides(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
      )
    },
  )

  fastify.delete(
    '/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides/:overrideId',
    { preHandler: fastify.requireAdminKey },
    async (request, reply) => {
      const params = deleteOverrideParamsSchema.parse(request.params)
      await service.deleteOverride(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
        params.overrideId,
      )
      return reply.status(204).send()
    },
  )
}
