import type { FastifyInstance } from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { projects, featureFlags } from '../../db/schema.js'

export async function publicRoutes(fastify: FastifyInstance) {
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
}
