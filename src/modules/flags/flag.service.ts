import { and, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, featureFlags, flagEnvironments } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateFlagInput, PatchFlagInput } from './flag.schema.js'

/**
 * Internal helper to find a flag by key within a project
 */
async function findFlag(db: Db, projectId: string, flagKey: string) {
  const [flag] = await db
    .select()
    .from(featureFlags)
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .limit(1)

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  return flag
}

/**
 * Internal helper to find an environment by slug within a project
 */
async function findEnvironment(db: Db, projectId: string, environmentSlug: string) {
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.slug, environmentSlug)))
    .limit(1)

  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }

  return environment
}

/**
 * Creates a new feature flag and initializes its state in all project environments
 */
export async function createFlag(db: Db, projectId: string, input: CreateFlagInput) {
  return db.transaction(async (tx) => {
    const [flag] = await tx
      .insert(featureFlags)
      .values({ ...input, projectId })
      .returning()
    const envs = await tx.select().from(environments).where(eq(environments.projectId, projectId))
    if (envs.length > 0) {
      await tx.insert(flagEnvironments).values(
        envs.map((environment) => ({
          flagId: flag.id,
          environmentId: environment.id,
          enabled: false,
        })),
      )
    }
    return flag
  })
}

/**
 * Lists all feature flags for a project
 */
export async function listFlags(db: Db, projectId: string) {
  return db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.projectId, projectId))
    .orderBy(featureFlags.createdAt)
}

/**
 * Retrieves a flag by its key
 */
export async function getFlag(db: Db, projectId: string, flagKey: string) {
  return findFlag(db, projectId, flagKey)
}

/**
 * Updates a flag's metadata (name, description)
 */
export async function patchFlag(db: Db, projectId: string, flagKey: string, input: PatchFlagInput) {
  const [flag] = await db
    .update(featureFlags)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .returning()

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  return flag
}

/**
 * Deletes a flag from the project
 */
export async function deleteFlag(db: Db, projectId: string, flagKey: string) {
  const [flag] = await db
    .delete(featureFlags)
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .returning()

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
}

/**
 * Enables or disables a flag for a specific environment
 */
export async function setFlagEnabled(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  enabled: boolean,
) {
  const flag = await findFlag(db, projectId, flagKey)
  const environment = await findEnvironment(db, projectId, environmentSlug)
  const [row] = await db
    .insert(flagEnvironments)
    .values({ flagId: flag.id, environmentId: environment.id, enabled })
    .onConflictDoUpdate({
      target: [flagEnvironments.flagId, flagEnvironments.environmentId],
      set: { enabled, updatedAt: sql`now()` },
    })
    .returning()
  return row
}
