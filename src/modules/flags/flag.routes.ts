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
    '/admin/projects/:projectId/flags',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Create a new feature flag within a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
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
    '/admin/projects/:projectId/flags',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all feature flags within a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = flagParamsSchema.pick({ projectId: true }).parse(request.params)
      return service.listFlags(fastify.db, params.projectId)
    },
  )

  fastify.get(
    '/admin/projects/:projectId/flags/:flagKey',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Get a feature flag by key.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
          },
          required: ['projectId', 'flagKey'],
        },
      },
    },
    async (request) => {
      const params = flagParamsSchema.parse(request.params)
      return service.getFlag(fastify.db, params.projectId, params.flagKey)
    },
  )

  fastify.patch(
    '/admin/projects/:projectId/flags/:flagKey',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Update a feature flag (name or description).',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
          },
          required: ['projectId', 'flagKey'],
        },
      },
    },
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
    '/admin/projects/:projectId/flags/:flagKey',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Delete a feature flag and its overrides.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            flagKey: { type: 'string' },
          },
          required: ['projectId', 'flagKey'],
        },
      },
    },
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
      `/admin/projects/:projectId/flags/:flagKey/environments/:environmentSlug/${action}`,
      {
        preHandler: fastify.requireAdminKey,
        schema: {
          tags: ['admin'],
          description: `${action === 'enable' ? 'Enable' : 'Disable'} a feature flag in a specific environment.`,
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
