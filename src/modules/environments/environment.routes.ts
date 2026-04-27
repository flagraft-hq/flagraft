import type { FastifyInstance } from 'fastify'

import {
  createEnvironmentSchema,
  environmentParamsSchema,
  projectEnvironmentParamsSchema,
} from './environment.schema.js'
import * as service from './environment.service.js'

export async function environmentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/admin/projects/:projectId/environments',
    { preHandler: fastify.requireAdminKey },
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
    '/api/admin/projects/:projectId/environments',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = projectEnvironmentParamsSchema.parse(request.params)
      return service.listEnvironments(fastify.db, params.projectId)
    },
  )

  fastify.delete(
    '/api/admin/projects/:projectId/environments/:environmentId',
    { preHandler: fastify.requireAdminKey },
    async (request, reply) => {
      const params = environmentParamsSchema.parse(request.params)
      await service.deleteEnvironment(fastify.db, params.projectId, params.environmentId)
      return reply.status(204).send()
    },
  )
}
