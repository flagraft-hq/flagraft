import type { FastifyInstance } from 'fastify'

import { inviteUserSchema, patchUserSchema } from './user.schema.js'
import * as service from './user.service.js'
import { AppError } from '../../plugins/errorHandler.js'
import { isMailerConfigured, sendInviteEmail } from '../../mailer.js'

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/users', { preHandler: fastify.requireAdminKey }, async () => {
    return service.listUsers(fastify.db)
  })

  fastify.get('/admin/users/:id', { preHandler: fastify.requireAdminKey }, async (req) => {
    const { id } = req.params as { id: string }
    const user = await service.getUserWithProjects(fastify.db, id)
    if (!user) throw new AppError('User not found', 404, 'Not Found')
    return user
  })

  fastify.post(
    '/admin/users/invite',
    { preHandler: fastify.requireAdminKey },
    async (req, reply) => {
      const { emails, role, projectIds } = inviteUserSchema.parse(req.body)
      const results = await Promise.all(
        emails.map((email) => service.inviteUser(fastify.db, { email, role, projectIds })),
      )

      /**
       * Base URL for the invite link: prefer the configured APP_BASE_URL, then
       * the requesting origin, so the link works on self-hosted setups that
       * never set APP_BASE_URL.
       */
      const base = (
        fastify.config.APP_BASE_URL ??
        (req.headers.origin as string | undefined) ??
        `${req.protocol}://${req.headers.host}`
      ).replace(/\/$/, '')

      const mailerOn = isMailerConfigured(fastify.config)
      const payload = await Promise.all(
        results.map(async (r) => {
          const inviteUrl = `${base}/invite/${r.token}`
          let emailed = false
          if (mailerOn) {
            try {
              await sendInviteEmail(fastify.config, { to: r.user.email, inviteUrl })
              emailed = true
            } catch (err) {
              /** Account is already created; admin can share the link manually. */
              fastify.log.warn({ err, email: r.user.email }, 'Failed to send invite email')
            }
          }
          return {
            id: r.user.id,
            email: r.user.email,
            inviteUrl,
            expiresAt: r.expiresAt.toISOString(),
            emailed,
          }
        }),
      )

      return reply.status(201).send(payload)
    },
  )

  fastify.patch('/admin/users/:id', { preHandler: fastify.requireAdminKey }, async (req) => {
    const { id } = req.params as { id: string }
    const data = patchUserSchema.parse(req.body)
    return service.patchUser(fastify.db, id, data)
  })

  fastify.post(
    '/admin/users/:id/reset-password',
    { preHandler: fastify.requireAdminKey },
    async (req) => {
      const { id } = req.params as { id: string }
      const tempPassword = await service.resetPassword(fastify.db, id)
      return { tempPassword }
    },
  )

  fastify.delete(
    '/admin/users/:id',
    { preHandler: fastify.requireAdminKey },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await service.deleteUser(fastify.db, id)
      return reply.status(204).send()
    },
  )

  fastify.post(
    '/admin/users/:id/projects/:projectId',
    { preHandler: fastify.requireAdminKey },
    async (req, reply) => {
      const { id, projectId } = req.params as { id: string; projectId: string }
      await service.addUserToProject(fastify.db, id, projectId)
      return reply.status(204).send()
    },
  )

  fastify.delete(
    '/admin/users/:id/projects/:projectId',
    { preHandler: fastify.requireAdminKey },
    async (req, reply) => {
      const { id, projectId } = req.params as { id: string; projectId: string }
      await service.removeUserFromProject(fastify.db, id, projectId)
      return reply.status(204).send()
    },
  )
}
