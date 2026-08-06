import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { API_KEY_TYPES } from '../../auth/constants.js'
import type { Db } from '../../db/index.js'
import { apiKeys, environments, projects } from '../../db/schema.js'
import { generateKey } from '../../plugins/auth.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateKeyInput, ListKeysQuery } from './key.schema.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Formats a raw database API key record for public consumption (hiding sensitive data)
 */
function publicKey(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id,
    prefix: row.keyPrefix,
    type: row.type,
    environmentId: row.environmentId,
    description: row.description,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  }
}

/**
 * Creates a new API key (admin or client) and returns the plaintext key once
 */
export async function createKey(db: Db, projectId: string, input: CreateKeyInput) {
  if (input.type === API_KEY_TYPES.CLIENT && !input.environmentId) {
    throw new AppError('Client keys require environmentId', 400, 'BadRequest')
  }

  if (input.type === API_KEY_TYPES.ADMIN && input.environmentId) {
    throw new AppError('Admin keys cannot be scoped to an environment', 400, 'BadRequest')
  }

  if (input.environmentId) {
    const [environment] = await db
      .select()
      .from(environments)
      .where(and(eq(environments.id, input.environmentId), eq(environments.projectId, projectId)))
      .limit(1)
    if (!environment) {
      throw new AppError('Environment not found', 404, 'NotFound')
    }
  }

  /**
   * Client keys are unlimited (per the Security settings copy); only newly
   * issued admin keys inherit the project's TTL. Existing keys are never
   * retroactively expired by a later TTL change.
   */
  let expiresAt: Date | null = null
  if (input.type === API_KEY_TYPES.ADMIN) {
    const [project] = await db
      .select({ settings: projects.settings })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    const ttlDays = project?.settings.security?.keyTtlDays
    if (typeof ttlDays === 'number') {
      expiresAt = new Date(Date.now() + ttlDays * DAY_MS)
    }
  }

  const generated = generateKey()
  const [row] = await db
    .insert(apiKeys)
    .values({
      projectId,
      environmentId: input.environmentId ?? null,
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
      type: input.type,
      description: input.description,
      expiresAt,
    })
    .returning()

  return {
    ...publicKey(row),
    key: generated.plaintext,
  }
}

/**
 * Escapes the LIKE wildcards in user input so a search for "50%" looks for a
 * literal percent sign instead of matching everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

const SORT_COLUMNS = {
  created: apiKeys.createdAt,
  lastUsed: apiKeys.lastUsedAt,
  label: apiKeys.description,
} as const

/**
 * Lists one page of a project's API keys, filtered and sorted in the database.
 * Returns the page plus the total number of matching rows.
 */
export async function listKeys(db: Db, projectId: string, query: ListKeysQuery) {
  const filters = [eq(apiKeys.projectId, projectId)]

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`
    filters.push(or(ilike(apiKeys.description, pattern), ilike(apiKeys.keyPrefix, pattern))!)
  }
  if (query.type) filters.push(eq(apiKeys.type, query.type))
  if (query.environmentId) filters.push(eq(apiKeys.environmentId, query.environmentId))

  const where = and(...filters)

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(where)

  const direction = query.dir === 'asc' ? asc : desc
  const rows = await db
    .select()
    .from(apiKeys)
    .where(where)
    /** Prefix breaks ties so paging never repeats or skips a row. */
    .orderBy(direction(SORT_COLUMNS[query.sort]), asc(apiKeys.keyPrefix))
    .limit(query.limit)
    .offset(query.offset)

  return {
    data: rows.map(publicKey),
    total: totals?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  }
}

/**
 * Revokes and deletes an API key
 */
export async function deleteKey(db: Db, projectId: string, keyId: string) {
  const [row] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .returning()

  if (!row) {
    throw new AppError('Key not found', 404, 'NotFound')
  }
}
