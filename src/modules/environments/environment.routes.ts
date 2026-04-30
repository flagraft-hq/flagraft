import type { FastifyInstance } from 'fastify'

import {
  createEnvironmentSchema,
  environmentParamsSchema,
  projectEnvironmentParamsSchema,
} from './environment.schema.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './environment.service.js'

export async function environmentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects/:projectId/environments',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Create a new environment within a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request, reply) => {
      const params = projectEnvironmentParamsSchema.parse(request.params)
      const environment = await service.createEnvironment(
        fastify.db,
        params.projectId,
        createEnvironmentSchema.parse(request.body),
      )
      return reply.status(201).send(environment)
    },
  )

  fastify.get(
    '/admin/projects/:projectId/environments',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all environments within a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = projectEnvironmentParamsSchema.parse(request.params)
      return service.listEnvironments(fastify.db, params.projectId)
    },
  )

  fastify.delete(
    '/admin/projects/:projectId/environments/:environmentId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Delete an environment and invalidate its cached flag state.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            environmentId: { type: 'string' },
          },
          required: ['projectId', 'environmentId'],
        },
      },
    },
    async (request, reply) => {
      const params = environmentParamsSchema.parse(request.params)
      await service.deleteEnvironment(fastify.db, params.projectId, params.environmentId)
      await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(params.projectId))
      return reply.status(204).send()
    },
  )
}
