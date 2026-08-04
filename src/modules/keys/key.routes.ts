import type { FastifyInstance } from 'fastify'

import {
  createKeySchema,
  keyParamsSchema,
  keyProjectParamsSchema,
  listKeysQuerySchema,
} from './key.schema.js'
import * as service from './key.service.js'
import { MAX_PAGE_SIZE } from '../../limits.js'

export async function keyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects/:projectId/keys',
    {
      preHandler: fastify.requireProjectAdmin,
      schema: {
        tags: ['admin'],
        description: 'Create a new API key for a project. Requires the owner or admin role.',
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
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 25 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            search: { type: 'string' },
            type: { type: 'string', enum: ['admin', 'client'] },
            environmentId: { type: 'string' },
            sort: { type: 'string', enum: ['created', 'lastUsed', 'label'], default: 'created' },
            dir: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request) => {
      const params = keyProjectParamsSchema.parse(request.params)
      const query = listKeysQuerySchema.parse(request.query)
      return service.listKeys(fastify.db, params.projectId, query)
    },
  )

  fastify.delete(
    '/admin/projects/:projectId/keys/:keyId',
    {
      preHandler: fastify.requireProjectAdmin,
      schema: {
        tags: ['admin'],
        description: 'Revoke an API key. Requires the owner or admin role.',
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
