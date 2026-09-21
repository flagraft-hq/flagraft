import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import type {} from '@fastify/cookie'
import type {} from '@fastify/jwt'

import { AppError } from '../../plugins/errorHandler.js'
import { rateLimitErrorResponse } from '../../plugins/rateLimit.js'
import { loginSchema } from './auth.schema.js'
import * as service from './auth.service.js'
import { SESSION_COOKIE, setSessionCookie } from './session.js'

const COOKIE = SESSION_COOKIE

export async function authRoutes(fastify: FastifyInstance) {
  /** Opt-in per route: only login pays the argon2 cost worth throttling. */
  await fastify.register(rateLimit, {
    global: false,
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: fastify.config.AUTH_RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: rateLimitErrorResponse,
  })

  fastify.post(
    '/admin/auth/login',
    { config: { skipAuth: true, rateLimit: {} } },
    async (req, reply) => {
      const { email, password } = loginSchema.parse(req.body)
      const user = await service.validateCredentials(fastify.db, email, password)
      if (user === 'suspended')
        throw new AppError(
          'Your account has been suspended. Contact your workspace admin.',
          403,
          'Forbidden',
        )
      if (!user) throw new AppError('Invalid email or password', 401, 'Unauthorized')

      setSessionCookie(fastify, reply, user)
      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })
    },
  )

  fastify.post('/admin/auth/logout', { config: { skipAuth: true } }, async (_req, reply) => {
    return reply.clearCookie(COOKIE, { path: '/' }).send({ ok: true })
  })

  /**
   * The global auth hook has already validated the session against the
   * database, so answer from there instead of trusting stale JWT claims.
   */
  fastify.get('/admin/auth/me', async (req, reply) => {
    const userId = req.keyContext?.userId
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' })
    const user = await service.getUserById(fastify.db, userId)
    if (!user) return reply.status(401).send({ error: 'Not authenticated' })
    return reply.send({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })
  })
}
