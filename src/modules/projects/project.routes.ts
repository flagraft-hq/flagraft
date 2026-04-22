import type { FastifyInstance } from 'fastify'

import {
  createProjectSchema,
  patchProjectSchema,
  projectIdParamsSchema
} from './project.schema.js'
import * as service from './project.service.js'

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.post('/api/admin/projects', { preHandler: fastify.requireRootKey }, async (request, reply) => {
    const project = await service.createProject(fastify.db, createProjectSchema.parse(request.body))
    return reply.status(201).send(project)
  })

  fastify.get('/api/admin/projects', { preHandler: fastify.requireAdminKey }, async (request) => {
    return service.listProjects(fastify.db, request.keyContext!)
  })

  fastify.get(
    '/api/admin/projects/:projectId',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = projectIdParamsSchema.parse(request.params)
      return service.getProject(fastify.db, params.projectId)
    }
  )

  fastify.patch(
    '/api/admin/projects/:projectId',
    { preHandler: fastify.requireAdminKey },
    async (request) => {
      const params = projectIdParamsSchema.parse(request.params)
      return service.patchProject(
        fastify.db,
        params.projectId,
        patchProjectSchema.parse(request.body)
      )
    }
  )

  fastify.delete(
    '/api/admin/projects/:projectId',
    { preHandler: fastify.requireRootKey },
    async (request, reply) => {
      const params = projectIdParamsSchema.parse(request.params)
      await service.deleteProject(fastify.db, params.projectId)
      return reply.status(204).send()
    }
  )
}
