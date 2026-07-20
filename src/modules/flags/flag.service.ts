import { and, eq, inArray, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, featureFlags, flagEnvironments, users } from '../../db/schema.js'
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
 * Helper to fetch a single flag with its environment states and author details
 */
export async function fetchFlagWithState(db: Db, projectId: string, flagKey: string) {
  const [flag] = await db
    .select({
      id: featureFlags.id,
      projectId: featureFlags.projectId,
      name: featureFlags.name,
      key: featureFlags.key,
      description: featureFlags.description,
      createdAt: featureFlags.createdAt,
      updatedAt: featureFlags.updatedAt,
      authorId: featureFlags.authorId,
      authorName: users.name,
    })
    .from(featureFlags)
    .leftJoin(users, eq(featureFlags.authorId, users.id))
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .limit(1)

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  const envStates = await db
    .select({
      slug: environments.slug,
      enabled: flagEnvironments.enabled,
    })
    .from(flagEnvironments)
    .innerJoin(environments, eq(flagEnvironments.environmentId, environments.id))
    .where(eq(flagEnvironments.flagId, flag.id))
    .orderBy(environments.createdAt)

  const statesMap: Record<string, { on: boolean }> = {}
  for (const row of envStates) {
    statesMap[row.slug] = {
      on: row.enabled,
    }
  }

  return {
    id: flag.id,
    projectId: flag.projectId,
    key: flag.key,
    name: flag.name,
    description: flag.description || '',
    tags: [],
    created: flag.createdAt.toISOString(),
    updated: flag.updatedAt.toISOString(),
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
    author: flag.authorName || 'System',
    state: statesMap,
  }
}

/**
 * Creates a new feature flag and initializes its state in all project environments
 */
export async function createFlag(
  db: Db,
  projectId: string,
  input: CreateFlagInput,
  authorId?: string | null,
) {
  const flag = await db.transaction(async (tx) => {
    const [newFlag] = await tx
      .insert(featureFlags)
      .values({ ...input, projectId, authorId })
      .returning()
    const envs = await tx.select().from(environments).where(eq(environments.projectId, projectId))
    if (envs.length > 0) {
      await tx.insert(flagEnvironments).values(
        envs.map((environment) => ({
          flagId: newFlag.id,
          environmentId: environment.id,
          enabled: false,
        })),
      )
    }
    return newFlag
  })

  return fetchFlagWithState(db, projectId, flag.key)
}

/**
 * Lists all feature flags for a project
 */
export async function listFlags(db: Db, projectId: string) {
  const flags = await db
    .select({
      id: featureFlags.id,
      projectId: featureFlags.projectId,
      name: featureFlags.name,
      key: featureFlags.key,
      description: featureFlags.description,
      createdAt: featureFlags.createdAt,
      updatedAt: featureFlags.updatedAt,
      authorId: featureFlags.authorId,
      authorName: users.name,
    })
    .from(featureFlags)
    .leftJoin(users, eq(featureFlags.authorId, users.id))
    .where(eq(featureFlags.projectId, projectId))
    .orderBy(featureFlags.createdAt)

  if (flags.length === 0) {
    return []
  }

  const flagIds = flags.map((f) => f.id)

  const envStates = await db
    .select({
      flagId: flagEnvironments.flagId,
      slug: environments.slug,
      enabled: flagEnvironments.enabled,
    })
    .from(flagEnvironments)
    .innerJoin(environments, eq(flagEnvironments.environmentId, environments.id))
    .where(inArray(flagEnvironments.flagId, flagIds))
    .orderBy(environments.createdAt)

  const statesMap: Record<string, Record<string, { on: boolean }>> = {}

  for (const row of envStates) {
    if (!statesMap[row.flagId]) {
      statesMap[row.flagId] = {}
    }
    statesMap[row.flagId][row.slug] = {
      on: row.enabled,
    }
  }

  return flags.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    key: f.key,
    name: f.name,
    description: f.description || '',
    tags: [],
    created: f.createdAt.toISOString(),
    updated: f.updatedAt.toISOString(),
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    author: f.authorName || 'System',
    state: statesMap[f.id] || {},
  }))
}

/**
 * Retrieves a flag by its key
 */
export async function getFlag(db: Db, projectId: string, flagKey: string) {
  return fetchFlagWithState(db, projectId, flagKey)
}

/**
 * Updates a flag's metadata (name, description)
 */
export async function patchFlag(
  db: Db,
  projectId: string,
  flagKey: string,
  input: PatchFlagInput,
  authorId?: string | null,
) {
  const [flag] = await db
    .update(featureFlags)
    .set({
      ...input,
      authorId: authorId !== undefined ? authorId : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .returning()

  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  return fetchFlagWithState(db, projectId, flag.key)
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
