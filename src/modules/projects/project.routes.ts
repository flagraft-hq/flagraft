import type { FastifyInstance } from 'fastify'

import { createProjectSchema, patchProjectSchema, projectIdParamsSchema } from './project.schema.js'
import * as service from './project.service.js'

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects',
    {
      preHandler: fastify.requireRootKey,
      schema: {
        tags: ['admin'],
        description: 'Create a new project. Requires a root admin key.',
      },
    },
    async (request, reply) => {
      const project = await service.createProject(
        fastify.db,
        createProjectSchema.parse(request.body),
      )
      return reply.status(201).send(project)
    },
  )

  fastify.get(
    '/admin/projects',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all projects accessible by the authenticated admin key.',
      },
    },
    async (request) => {
      return service.listProjects(fastify.db, request.keyContext!)
    },
  )

  fastify.get(
    '/admin/projects/:projectId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Get a project by ID.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = projectIdParamsSchema.parse(request.params)
      return service.getProject(fastify.db, params.projectId)
    },
  )

  fastify.patch(
    '/admin/projects/:projectId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Update a project name.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = projectIdParamsSchema.parse(request.params)
      return service.patchProject(
        fastify.db,
        params.projectId,
        patchProjectSchema.parse(request.body),
      )
    },
  )

  fastify.delete(
    '/admin/projects/:projectId',
    {
      preHandler: fastify.requireRootKey,
      schema: {
        tags: ['admin'],
        description: 'Delete a project and all its data. Requires a root admin key.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request, reply) => {
      const params = projectIdParamsSchema.parse(request.params)
      await service.deleteProject(fastify.db, params.projectId)
      return reply.status(204).send()
    },
  )
}
