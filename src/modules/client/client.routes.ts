import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { loadConfig } from '../../config.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './client.service.js'

const flagParamSchema = z.object({ flagKey: z.string().min(1) })

/**
 * Turns the request query string into an evaluation context. Query values are
 * always strings; a repeated param collapses to its first value. The SDK sends
 * context this way (e.g. ?tenant=phyg&plan=pro).
 */
function queryToContext(query: unknown): Record<string, string> {
  const context: Record<string, string> = {}
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      const first = Array.isArray(value) ? (value[0] as unknown) : value
      if (typeof first === 'string') context[key] = first
      else if (typeof first === 'number' || typeof first === 'boolean') context[key] = String(first)
    }
  }
  return context
}

export async function clientRoutes(fastify: FastifyInstance) {
  const config = loadConfig()

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      error: 'TooManyRequests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      statusCode: 429,
    }),
  })

  fastify.get(
    '/client/features',
    {
      preHandler: fastify.requireClientKey,
      schema: {
        tags: ['client'],
        description: 'Evaluate all feature flags for the authenticated client key.',
        response: {
          200: {
            type: 'object',
            properties: {
              features: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    enabled: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const ctx = request.keyContext!
      const state = await fastify.cache.getOrSet(
        cacheKeys.flagState(ctx.projectId!, ctx.environmentId!),
        () => service.loadEnvState(fastify.db, ctx.projectId!, ctx.environmentId!),
      )
      return { features: service.evaluateAll(state, queryToContext(request.query)) }
    },
  )

  fastify.get(
    '/client/features/:flagKey',
    {
      preHandler: fastify.requireClientKey,
      schema: {
        tags: ['client'],
        description: 'Evaluate a single feature flag by key for the authenticated client.',
        params: {
          type: 'object',
          properties: { flagKey: { type: 'string' } },
          required: ['flagKey'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              enabled: { type: 'boolean' },
              reason: { type: 'string', enum: ['disabled', 'strategy-match', 'default'] },
            },
          },
        },
      },
    },
    async (request) => {
      const ctx = request.keyContext!
      const params = flagParamSchema.parse(request.params)
      const state = await fastify.cache.getOrSet(
        cacheKeys.flagState(ctx.projectId!, ctx.environmentId!),
        () => service.loadEnvState(fastify.db, ctx.projectId!, ctx.environmentId!),
      )
      return service.evaluateOne(state, params.flagKey, queryToContext(request.query))
    },
  )
}
