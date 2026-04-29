import type { FastifyInstance } from 'fastify'

import {
  createFlagSchema,
  flagEnvironmentParamsSchema,
  flagParamsSchema,
  patchFlagSchema,
} from './flag.schema.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './flag.service.js'

export async function flagRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/admin/projects/:projectId/flags',
    { preHandler: fastify.requireAdminKey },
    async (request, reply) => {
      const params = flagParamsSchema.pick({ projectId: true }).parse(request.params)
      const flag = await service.createFlag(
        fastify.db,
        params.projectId,
        createFlagSchema.parse(request.body),
      )
      await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(params.projectId))
      return reply.status(201).send(flag)
    },
  )

  fastify.get(
    '/api/admin/projects/:projectId/flags',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = flagParamsSchema.pick({ projectId: true }).parse(request.params)
      return service.listFlags(fastify.db, params.projectId)
    },
  )

  fastify.get(
    '/api/admin/projects/:projectId/flags/:flagKey',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = flagParamsSchema.parse(request.params)
      return service.getFlag(fastify.db, params.projectId, params.flagKey)
    },
  )

  fastify.patch(
    '/api/admin/projects/:projectId/flags/:flagKey',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = flagParamsSchema.parse(request.params)
      return service.patchFlag(
        fastify.db,
        params.projectId,
        params.flagKey,
        patchFlagSchema.parse(request.body),
      )
    },
  )

  fastify.delete(
    '/api/admin/projects/:projectId/flags/:flagKey',
    { preHandler: fastify.requireAdminKey },
    async (request, reply) => {
      const params = flagParamsSchema.parse(request.params)
      await service.deleteFlag(fastify.db, params.projectId, params.flagKey)
      await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(params.projectId))
      return reply.status(204).send()
    },
  )

  for (const [action, enabled] of [
    ['enable', true],
    ['disable', false],
  ] as const) {
    fastify.post(
      `/api/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/${action}`,
      { preHandler: fastify.requireAdminKey },
      async (request) => {
        const params = flagEnvironmentParamsSchema.parse(request.params)
        const row = await service.setFlagEnabled(
          fastify.db,
          params.projectId,
          params.flagKey,
          params.environmentSlug,
          enabled,
        )
        await fastify.cache.delete(cacheKeys.flagState(params.projectId, row.environmentId))
        return row
      },
    )
  }
}
