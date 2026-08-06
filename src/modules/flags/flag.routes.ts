import type { FastifyInstance } from 'fastify'

import {
  createFlagSchema,
  flagEnvironmentParamsSchema,
  flagParamsSchema,
  listFlagsQuerySchema,
  patchFlagSchema,
} from './flag.schema.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './flag.service.js'
import { canBypassEnvironmentProtection, resolveActorLabel } from '../../plugins/auth.js'
import { MAX_PAGE_SIZE } from '../../limits.js'

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
        request.keyContext?.userId,
        canBypassEnvironmentProtection(request.keyContext!),
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
        description:
          'List one page of feature flags within a project. Filtering, sorting and paging ' +
          'happen in the database; the response carries the total match count.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 25 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            search: { type: 'string' },
            state: { type: 'string', enum: ['on', 'off'] },
            env: { type: 'string' },
            sort: { type: 'string', enum: ['name', 'key', 'updated'], default: 'updated' },
            dir: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request) => {
      const params = flagParamsSchema.pick({ projectId: true }).parse(request.params)
      const query = listFlagsQuerySchema.parse(request.query)
      return service.listFlags(fastify.db, params.projectId, query)
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
        request.keyContext?.userId,
      )
    },
  )

  fastify.delete(
    '/admin/projects/:projectId/flags/:flagKey',
    {
      preHandler: fastify.requireProjectAdmin,
      schema: {
        tags: ['admin'],
        description:
          'Delete a feature flag. Removing it changes behaviour in every environment, ' +
          'including protected ones, so this requires the owner or admin role.',
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
        preHandler: fastify.requireEnvironmentWrite,
        schema: {
          tags: ['admin'],
          description:
            `${action === 'enable' ? 'Enable' : 'Disable'} a feature flag in a specific ` +
            'environment. Protected environments are limited to owners and admins, and if the ' +
            'project requires approval in prod, a second distinct admin must repeat the same ' +
            "call before it takes effect -- the first call returns 202 and doesn't apply yet.",
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
        const params = flagEnvironmentParamsSchema.parse(request.params)
        const actor = await resolveActorLabel(fastify.db, request.keyContext!)
        const result = await service.setFlagEnabled(
          fastify.db,
          params.projectId,
          params.flagKey,
          params.environmentSlug,
          enabled,
          actor,
        )
        if (!result.applied) {
          return reply.status(202).send({
            pending: true,
            requestedEnabled: result.requestedEnabled,
            requestedBy: result.requestedBy,
          })
        }
        await fastify.cache.delete(cacheKeys.flagState(params.projectId, result.row.environmentId))
        return result.row
      },
    )
  }
}
