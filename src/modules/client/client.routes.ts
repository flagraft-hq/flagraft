import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import type { EvaluationContext } from '../../evaluation/engine.js'
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
  fastify.get('/api/client/features', { preHandler: fastify.requireClientKey }, async (request) => {
    const context = request.keyContext!
    const state = await service.loadFlagState(fastify.db, context.projectId!, context.environmentId!)
    return { features: service.evaluateAll(state, queryToContext(request.query)) }
  })

  fastify.get(
    '/api/client/features/:flagKey',
    { preHandler: fastify.requireClientKey },
    async (request) => {
      const context = request.keyContext!
      const params = flagParamSchema.parse(request.params)
      return service.evaluateOne(
        fastify.db,
        context.projectId!,
        context.environmentId!,
        params.flagKey,
        queryToContext(request.query)
      )
    }
  )
}
