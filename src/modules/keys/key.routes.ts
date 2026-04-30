import type { FastifyInstance } from 'fastify'

import { createKeySchema, keyParamsSchema, keyProjectParamsSchema } from './key.schema.js'
import * as service from './key.service.js'

export async function keyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects/:projectId/keys',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Create a new API key for a project.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request, reply) => {
      const params = keyProjectParamsSchema.parse(request.params)
      const key = await service.createKey(
        fastify.db,
        params.projectId,
        createKeySchema.parse(request.body),
      )
      return reply.status(201).send(key)
    },
  )

  fastify.get(
    '/admin/projects/:projectId/keys',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'List all API keys for a project (hashes are not exposed).',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const params = keyProjectParamsSchema.parse(request.params)
      return service.listKeys(fastify.db, params.projectId)
    },
  )

  fastify.delete(
    '/admin/projects/:projectId/keys/:keyId',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description: 'Revoke an API key.',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            keyId: { type: 'string' },
          },
          required: ['projectId', 'keyId'],
        },
      },
    },
    async (request, reply) => {
      const params = keyParamsSchema.parse(request.params)
      await service.deleteKey(fastify.db, params.projectId, params.keyId)
      return reply.status(204).send()
    },
  )
}
