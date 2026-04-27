import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, featureFlags, flagOverrides } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateOverrideInput } from './override.schema.js'

async function lookup(db: Db, projectId: string, flagKey: string, environmentSlug: string) {
  const [flag] = await db
    .select()
    .from(featureFlags)
    .where(and(eq(featureFlags.projectId, projectId), eq(featureFlags.key, flagKey)))
    .limit(1)
  if (!flag) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.slug, environmentSlug)))
    .limit(1)
  if (!environment) {
    throw new AppError('Environment not found', 404, 'NotFound')
  }

  return { flag, environment }
}

export async function createOverride(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  input: CreateOverrideInput,
) {
  const { flag, environment } = await lookup(db, projectId, flagKey, environmentSlug)
  const [override] = await db
    .insert(flagOverrides)
    .values({
      flagId: flag.id,
      environmentId: environment.id,
      contextKey: input.contextKey,
      contextValue: input.contextValue,
      enabled: input.enabled,
    })
    .returning()
  return override
}

export async function listOverrides(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
) {
  const { flag, environment } = await lookup(db, projectId, flagKey, environmentSlug)
  return db
    .select()
    .from(flagOverrides)
    .where(and(eq(flagOverrides.flagId, flag.id), eq(flagOverrides.environmentId, environment.id)))
    .orderBy(flagOverrides.createdAt)
}

export async function deleteOverride(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  overrideId: string,
) {
  const { flag, environment } = await lookup(db, projectId, flagKey, environmentSlug)
  const [override] = await db
    .delete(flagOverrides)
    .where(
      and(
        eq(flagOverrides.id, overrideId),
        eq(flagOverrides.flagId, flag.id),
        eq(flagOverrides.environmentId, environment.id),
      ),
    )
    .returning()

  if (!override) {
    throw new AppError('Override not found', 404, 'NotFound')
  }
}
