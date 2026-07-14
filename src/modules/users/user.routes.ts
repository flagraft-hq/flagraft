import type { FastifyInstance, FastifyRequest } from 'fastify'

import { inviteUserSchema, patchUserSchema, resetPasswordSchema } from './user.schema.js'
import * as service from './user.service.js'
import { AppError } from '../../plugins/errorHandler.js'
import { isMailerConfigured, sendInviteEmail } from '../../mailer.js'

/**
 * Base URL for invite links: prefer the configured APP_BASE_URL, then the
 * requesting origin, so links work on self-hosted setups that never set
 * APP_BASE_URL.
 */
function inviteBaseUrl(fastify: FastifyInstance, req: FastifyRequest): string {
  return (
    fastify.config.APP_BASE_URL ??
    req.headers.origin ??
    `${req.protocol}://${req.headers.host}`
  ).replace(/\/$/, '')
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/users', { preHandler: fastify.requireRootKey }, async () => {
    return service.listUsers(fastify.db)
  })

  fastify.get('/admin/users/:id', { preHandler: fastify.requireRootKey }, async (req) => {
    const { id } = req.params as { id: string }
    const user = await service.getUserWithProjects(fastify.db, id)
    if (!user) throw new AppError('User not found', 404, 'Not Found')
    return user
  })

  fastify.post(
    '/admin/users/invite',
    { preHandler: fastify.requireRootKey },
    async (req, reply) => {
      const { emails, role, projectIds } = inviteUserSchema.parse(req.body)
      const results = await Promise.all(
        emails.map((email) => service.inviteUser(fastify.db, { email, role, projectIds })),
      )

      const base = inviteBaseUrl(fastify, req)
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

  fastify.post(
    '/admin/users/:id/resend-invite',
    { preHandler: fastify.requireRootKey },
    async (req) => {
      const { id } = req.params as { id: string }
      const result = await service.reissueInvite(fastify.db, id)
      if (!result) throw new AppError('No pending invite for this user', 404, 'Not Found')

      const inviteUrl = `${inviteBaseUrl(fastify, req)}/invite/${result.token}`
      let emailed = false
      if (isMailerConfigured(fastify.config)) {
        try {
          await sendInviteEmail(fastify.config, { to: result.user.email, inviteUrl })
          emailed = true
        } catch (err) {
          /** The new link is already active; admin can share it manually. */
          fastify.log.warn({ err, email: result.user.email }, 'Failed to send invite email')
        }
      }
      return {
        id: result.user.id,
        email: result.user.email,
        inviteUrl,
        expiresAt: result.expiresAt.toISOString(),
        emailed,
      }
    },
  )

  fastify.patch('/admin/users/:id', { preHandler: fastify.requireRootKey }, async (req) => {
    const { id } = req.params as { id: string }
    const data = patchUserSchema.parse(req.body)
    return service.toPublicUser(await service.patchUser(fastify.db, id, data))
  })

  fastify.post(
    '/admin/users/:id/reset-password',
    { preHandler: fastify.requireRootKey },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const { password } = resetPasswordSchema.parse(req.body)
      const user = await service.resetPassword(fastify.db, id, password)
      if (!user) throw new AppError('User not found', 404, 'Not Found')
      return reply.status(204).send()
    },
  )

  fastify.delete('/admin/users/:id', { preHandler: fastify.requireRootKey }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await service.deleteUser(fastify.db, id)
    return reply.status(204).send()
  })

  fastify.post(
    '/admin/users/:id/projects/:projectId',
    { preHandler: fastify.requireRootKey },
    async (req, reply) => {
      const { id, projectId } = req.params as { id: string; projectId: string }
      await service.addUserToProject(fastify.db, id, projectId)
      return reply.status(204).send()
    },
  )

  fastify.delete(
    '/admin/users/:id/projects/:projectId',
    { preHandler: fastify.requireRootKey },
    async (req, reply) => {
      const { id, projectId } = req.params as { id: string; projectId: string }
      await service.removeUserFromProject(fastify.db, id, projectId)
      return reply.status(204).send()
    },
  )
}
