import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateEnvironmentInput } from './environment.schema.js'

export async function createEnvironment(db: Db, projectId: string, input: CreateEnvironmentInput) {
  const [environment] = await db
    .insert(environments)
    .values({ ...input, projectId })
    .returning()
  return environment
}

export async function listEnvironments(db: Db, projectId: string) {
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(environments.createdAt)
}

export async function deleteEnvironment(db: Db, projectId: string, environmentId: string) {
  const [environment] = await db
    .delete(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
    .returning()

  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }
}
