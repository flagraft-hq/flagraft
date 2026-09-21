import type { errorResponseBuilderContext } from '@fastify/rate-limit'
import type { FastifyRequest } from 'fastify'

export function rateLimitErrorResponse(
  _request: FastifyRequest,
  context: errorResponseBuilderContext,
) {
  return {
    error: 'TooManyRequests',
    message: `Rate limit exceeded, retry in ${context.after}`,
    statusCode: 429,
  }
}
