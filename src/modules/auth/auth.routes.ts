import type { FastifyInstance } from 'fastify'
import type {} from '@fastify/cookie'
import type {} from '@fastify/jwt'

import { AppError } from '../../plugins/errorHandler.js'
import { loginSchema } from './auth.schema.js'
import * as service from './auth.service.js'
import { SESSION_COOKIE, setSessionCookie } from './session.js'

const COOKIE = SESSION_COOKIE

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/admin/auth/login', { config: { skipAuth: true } }, async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body)
    const user = await service.validateCredentials(fastify.db, email, password)
    if (!user) throw new AppError('Invalid email or password', 401, 'Unauthorized')

    setSessionCookie(fastify, reply, user)
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  })

  fastify.post('/admin/auth/logout', { config: { skipAuth: true } }, async (_req, reply) => {
    return reply.clearCookie(COOKIE, { path: '/' }).send({ ok: true })
  })

  fastify.get('/admin/auth/me', { config: { skipAuth: true } }, async (req, reply) => {
    const token = req.cookies?.[COOKIE]
    if (!token) return reply.status(401).send({ error: 'Not authenticated' })
    try {
      const payload = fastify.jwt.verify<{
        sub: string
        email: string
        role: string
        name: string
      }>(token)
      return reply.send({
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      })
    } catch {
      return reply.status(401).send({ error: 'Invalid session' })
    }
  })
}
