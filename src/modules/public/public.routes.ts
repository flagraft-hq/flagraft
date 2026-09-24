import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { projects, featureFlags } from '../../db/schema.js'
import { setSessionCookie } from '../auth/session.js'
import { acceptInviteSchema } from '../users/user.schema.js'
import * as users from '../users/user.service.js'
import { AppError } from '../../plugins/errorHandler.js'
import { rateLimitErrorResponse } from '../../plugins/rateLimit.js'

export async function publicRoutes(fastify: FastifyInstance) {
  /** Invite routes only: /public/workspace is fetched on every login page load. */
  await fastify.register(rateLimit, {
    global: false,
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: fastify.config.AUTH_RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: rateLimitErrorResponse,
  })

  fastify.get('/public/workspace', { config: { skipAuth: true } }, async () => {
    const [project] = await fastify.db.select().from(projects).orderBy(projects.createdAt).limit(1)

    if (!project) {
      return { projectName: null, flagCount: 0 }
    }

    const [{ count }] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(featureFlags)
      .where(eq(featureFlags.projectId, project.id))

    return { projectName: project.name, flagCount: count }
  })

  /** Validates an invite token so the accept screen can show who it is for. */
  fastify.get(
    '/public/invite/:token',
    { config: { skipAuth: true, rateLimit: {} } },
    async (req) => {
      const { token } = req.params as { token: string }
      const user = await users.getUserByInviteToken(fastify.db, token)
      if (!user) throw new AppError('This invite link is invalid or has expired', 410, 'Gone')
      return { email: user.email, name: user.name }
    },
  )

  /** Accepts an invite: sets the password, activates the account, and logs in. */
  fastify.post(
    '/public/invite/:token/accept',
    { config: { skipAuth: true, rateLimit: {} } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      const { password } = acceptInviteSchema.parse(req.body)
      const user = await users.acceptInvite(fastify.db, token, password)
      if (!user) throw new AppError('This invite link is invalid or has expired', 410, 'Gone')

      setSessionCookie(fastify, reply, user)
      return reply
        .status(200)
        .send({ id: user.id, email: user.email, name: user.name, role: user.role })
    },
  )
}
