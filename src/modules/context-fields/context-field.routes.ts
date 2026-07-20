import type { FastifyInstance } from 'fastify'

import {
  contextFieldIdParamsSchema,
  contextFieldParamsSchema,
  createContextFieldSchema,
  updateContextFieldSchema,
} from './context-field.schema.js'
import * as service from './context-field.service.js'

export async function contextFieldRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/projects/:projectId/context-fields',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all context fields defined for a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = contextFieldParamsSchema.parse(request.params)
      return service.listContextFields(fastify.db, params.projectId)
    },
  )

  fastify.post(
    '/admin/projects/:projectId/context-fields',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Create a context field within a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request, reply) => {
      const params = contextFieldParamsSchema.parse(request.params)
      const field = await service.createContextField(
        fastify.db,
        params.projectId,
        createContextFieldSchema.parse(request.body),
      )
      return reply.status(201).send(field)
    },
  )

  fastify.patch(
    '/admin/projects/:projectId/context-fields/:fieldId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Update a context field. The key is immutable.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            fieldId: { type: 'string' },
          },
          required: ['projectId', 'fieldId'],
        },
      },
    },
    async (request) => {
      const params = contextFieldIdParamsSchema.parse(request.params)
      return service.updateContextField(
        fastify.db,
        params.projectId,
        params.fieldId,
        updateContextFieldSchema.parse(request.body),
      )
    },
  )

  fastify.delete(
    '/admin/projects/:projectId/context-fields/:fieldId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Delete a context field.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            fieldId: { type: 'string' },
          },
          required: ['projectId', 'fieldId'],
        },
      },
    },
    async (request, reply) => {
      const params = contextFieldIdParamsSchema.parse(request.params)
      await service.deleteContextField(fastify.db, params.projectId, params.fieldId)
      return reply.status(204).send()
    },
  )
}
