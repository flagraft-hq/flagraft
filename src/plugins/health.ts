import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Registers health check endpoints for monitoring.
 *
 * - /health: Returns "ok" if the server is running.
 * - /ready: Returns "ok" only if the server can also connect to the database.
 */
async function healthPlugin(fastify: FastifyInstance) {
  fastify.get('/health', { config: { skipAuth: true } }, (_request, reply) => {
    return reply.send({ status: 'ok', uptime: process.uptime() })
  })

  fastify.get('/ready', { config: { skipAuth: true } }, async (_request, reply) => {
    try {
      await fastify.db.execute(sql`SELECT 1`)
      return reply.send({ status: 'ok' })
    } catch {
      return reply.status(503).send({ status: 'unavailable' })
    }
  })
}

export default fp(healthPlugin, { name: 'health', dependencies: ['db'] })
