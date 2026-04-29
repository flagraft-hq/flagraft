import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Ensures every response includes the unique request ID in its headers.
 * This makes it easier to trace and debug specific requests in logs.
 */
async function requestIdPlugin(fastify: FastifyInstance) {
  fastify.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('X-Request-Id', _request.id)
    done()
  })
}

export default fp(requestIdPlugin, { name: 'request-id' })
