import type { FastifyInstance } from 'fastify'

import { inviteUserSchema, patchUserSchema } from './user.schema.js'
import * as service from './user.service.js'
import { AppError } from '../../plugins/errorHandler.js'

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
      return reply.status(201).send(
        results.map((r) => ({
          id: r.user.id,
          email: r.user.email,
          tempPassword: r.tempPassword,
        })),
      )
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
