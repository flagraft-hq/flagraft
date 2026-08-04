import { and, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import { MAX_ENVIRONMENTS_PER_PROJECT } from '../../limits.js'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from './environment.schema.js'

/**
 * Creates a new environment within a project
 */
export async function createEnvironment(db: Db, projectId: string, input: CreateEnvironmentInput) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(environments)
    .where(eq(environments.projectId, projectId))
  if (count >= MAX_ENVIRONMENTS_PER_PROJECT) {
    throw new AppError(
      `A project can have at most ${MAX_ENVIRONMENTS_PER_PROJECT} environments. ` +
        'Delete one before adding another.',
      409,
      'Conflict',
    )
  }

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
  const [existing] = await db
    .select({ protected: environments.protected })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
    .limit(1)

  if (!existing) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }

  /**
   * Protection is what keeps editors out of an environment, so deleting a
   * protected one would be a way around that. Turning protection off is an
   * owner/admin action, which makes the intent explicit.
   */
  if (existing.protected) {
    throw new AppError(
      'This environment is protected. Turn protection off before deleting it.',
      409,
      'Conflict',
    )
  }

  await db
    .delete(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId)))
}
