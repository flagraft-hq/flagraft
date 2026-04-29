import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import type { EvaluationContext } from '../../evaluation/engine.js'
import { cacheKeys } from '../../cache/keys.js'
import * as service from './client.service.js'

const flagParamSchema = z.object({ flagKey: z.string().min(1) })

function queryToContext(query: unknown): EvaluationContext {
  const context: EvaluationContext = {}
  if (typeof query !== 'object' || query === null) {
    return context
  }

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (typeof value === 'string') {
      context[key] = value
    }
  }

  return context
}

export async function clientRoutes(fastify: FastifyInstance) {
  fastify.get('/client/features', { preHandler: fastify.requireClientKey }, async (request) => {
    const ctx = request.keyContext!
    const state = await fastify.cache.getOrSet(
      cacheKeys.flagState(ctx.projectId!, ctx.environmentId!),
      () => service.loadFlagState(fastify.db, ctx.projectId!, ctx.environmentId!),
    )
    return { features: service.evaluateAll(state, queryToContext(request.query)) }
  })

  fastify.get(
    '/client/features/:flagKey',
    { preHandler: fastify.requireClientKey },
    async (request) => {
      const ctx = request.keyContext!
      const params = flagParamSchema.parse(request.params)
      const state = await fastify.cache.getOrSet(
        cacheKeys.flagState(ctx.projectId!, ctx.environmentId!),
        () => service.loadFlagState(fastify.db, ctx.projectId!, ctx.environmentId!),
      )
      return service.evaluateOne(state, params.flagKey, queryToContext(request.query))
    },
  )
}
