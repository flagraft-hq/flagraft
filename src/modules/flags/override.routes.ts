import type { FastifyInstance } from 'fastify'

import {
  createOverrideSchema,
  deleteOverrideParamsSchema,
  overrideParamsSchema,
} from './override.schema.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './override.service.js'

export async function overrideRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Create a context-based override for a flag in a specific environment.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
            environmentSlug: { type: 'string' },
          },
          required: ['projectId', 'flagKey', 'environmentSlug'],
        },
      },
    },
    async (request, reply) => {
      const params = overrideParamsSchema.parse(request.params)
      const override = await service.createOverride(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
        createOverrideSchema.parse(request.body),
      )
      await fastify.cache.delete(cacheKeys.flagState(params.projectId, override.environmentId))
      return reply.status(201).send(override)
    },
  )

  fastify.get(
    '/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all overrides for a flag in a specific environment.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
            environmentSlug: { type: 'string' },
          },
          required: ['projectId', 'flagKey', 'environmentSlug'],
        },
      },
    },
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
    '/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/overrides/:overrideId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Delete a specific context override.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
            environmentSlug: { type: 'string' },
            overrideId: { type: 'string' },
          },
          required: ['projectId', 'flagKey', 'environmentSlug', 'overrideId'],
        },
      },
    },
    async (request, reply) => {
      const params = deleteOverrideParamsSchema.parse(request.params)
      const override = await service.deleteOverride(
        fastify.db,
        params.projectId,
        params.flagKey,
        params.environmentSlug,
        params.overrideId,
      )
      await fastify.cache.delete(cacheKeys.flagState(params.projectId, override.environmentId))
      return reply.status(204).send()
    },
  )
}
