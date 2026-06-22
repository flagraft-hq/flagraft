import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from './environment.schema.js'

/**
 * Creates a new environment within a project
 */
export async function createEnvironment(db: Db, projectId: string, input: CreateEnvironmentInput) {
  const [environment] = await db
    .insert(environments)
    .values({ ...input, projectId })
    .returning()
  return environment
}

/**
 * Lists all environments for a given project
 */
export async function listEnvironments(db: Db, projectId: string) {
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(environments.createdAt)
}

/**
 * Updates an environment's mutable fields (name, protected). The slug is
 * immutable, so it is never changed here.
 */
export async function updateEnvironment(
  db: Db,
  projectId: string,
  environmentId: string,
  input: UpdateEnvironmentInput,
) {
  const [environment] = await db
    .update(environments)
    .set(input)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
    .returning()

  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }
  return environment
}

/**
 * Deletes an environment from a project
 */
export async function deleteEnvironment(db: Db, projectId: string, environmentId: string) {
  const [environment] = await db
    .delete(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
    .returning()

  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }
}
