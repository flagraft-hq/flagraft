import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import {
  environments,
  featureFlags,
  flagEnvironments,
  projects,
  users,
  type DefaultFlagState,
} from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateFlagInput, ListFlagsQuery, PatchFlagInput } from './flag.schema.js'

/**
 * Escapes the LIKE wildcards in user input so a search for "50%" looks for a
 * literal percent sign instead of matching everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Resolves the initial on/off state for a new flag in one environment, based on
 * the project's default. 'dev' turns the flag on only in the development env.
 * A protected environment is never auto-enabled for a caller who couldn't
 * have turned it on directly (an editor) -- otherwise a project default of
 * "on" would let flag creation bypass the toggle/targeting write guard.
 */
function initialEnabled(
  defaultState: DefaultFlagState | undefined,
  envSlug: string,
  isProtected: boolean,
  allowProtectedInitialState: boolean,
): boolean {
  if (isProtected && !allowProtectedInitialState) return false
  if (defaultState === 'on') return true
  if (defaultState === 'dev') return envSlug === 'development'
  return false
}

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
  allowProtectedInitialState = false,
) {
  const flag = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ settings: projects.settings })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    const flagDefaults = project?.settings.flagDefaults ?? {}

    /** Project may require a description before a flag can be created. */
    if (flagDefaults.requireDescription && !input.description?.trim()) {
      throw new AppError(
        'A description is required for new flags in this project',
        400,
        'BadRequest',
      )
    }

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
          enabled: initialEnabled(
            flagDefaults.defaultState,
            environment.slug,
            environment.protected,
            allowProtectedInitialState,
          ),
        })),
      )
    }
    return newFlag
  })

  return fetchFlagWithState(db, projectId, flag.key)
}

const SORT_COLUMNS = {
  name: featureFlags.name,
  key: featureFlags.key,
  updated: featureFlags.updatedAt,
} as const

/**
 * Lists one page of feature flags for a project, filtered and sorted in the
 * database. Returns the page plus the total number of matching rows so the
 * caller can render page numbers.
 */
export async function listFlags(db: Db, projectId: string, query: ListFlagsQuery) {
  const filters = [eq(featureFlags.projectId, projectId)]

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`
    filters.push(
      or(
        ilike(featureFlags.name, pattern),
        ilike(featureFlags.key, pattern),
        ilike(featureFlags.description, pattern),
      )!,
    )
  }

  /**
   * The state filter only means something relative to an environment, so it
   * is ignored unless the caller says which one.
   */
  if (query.state && query.env) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(flagEnvironments)
          .innerJoin(environments, eq(flagEnvironments.environmentId, environments.id))
          .where(
            and(
              eq(flagEnvironments.flagId, featureFlags.id),
              eq(environments.slug, query.env),
              eq(flagEnvironments.enabled, query.state === 'on'),
            ),
          ),
      ),
    )
  }

  const where = and(...filters)

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(featureFlags)
    .where(where)
  const total = totals?.total ?? 0

  const direction = query.dir === 'asc' ? asc : desc
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
    .where(where)
    /** Key breaks ties so paging never repeats or skips a row. */
    .orderBy(direction(SORT_COLUMNS[query.sort]), asc(featureFlags.key))
    .limit(query.limit)
    .offset(query.offset)

  if (flags.length === 0) {
    return { data: [], total, limit: query.limit, offset: query.offset }
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

  const data = flags.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    key: f.key,
    name: f.name,
    description: f.description || '',
    created: f.createdAt.toISOString(),
    updated: f.updatedAt.toISOString(),
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    author: f.authorName || 'System',
    state: statesMap[f.id] || {},
  }))

  return { data, total, limit: query.limit, offset: query.offset }
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
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(flagEnvironments)
      .values({ flagId: flag.id, environmentId: environment.id, enabled })
      .onConflictDoUpdate({
        target: [flagEnvironments.flagId, flagEnvironments.environmentId],
        set: { enabled, updatedAt: sql`now()` },
      })
      .returning()
    /** A value change bumps the flag's updatedAt so staleness reflects toggles, not just edits. */
    await tx.update(featureFlags).set({ updatedAt: new Date() }).where(eq(featureFlags.id, flag.id))
    return row
  })
}
