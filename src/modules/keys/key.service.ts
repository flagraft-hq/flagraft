import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { apiKeys, environments } from '../../db/schema.js'
import { generateKey } from '../../plugins/auth.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { CreateKeyInput } from './key.schema.js'

function publicKey(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id,
    prefix: row.keyPrefix,
    type: row.type,
    environmentId: row.environmentId,
    description: row.description,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  }
}

export async function createKey(db: Db, projectId: string, input: CreateKeyInput) {
  if (input.type === 'client' && !input.environmentId) {
    throw new AppError('Client keys require environmentId', 400, 'BadRequest')
  }

  if (input.type === 'admin' && input.environmentId) {
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
    })
    .returning()

  return {
    ...publicKey(row),
    key: generated.plaintext,
  }
}

export async function listKeys(db: Db, projectId: string) {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId))
    .orderBy(apiKeys.createdAt)
  return rows.map(publicKey)
}

export async function deleteKey(db: Db, projectId: string, keyId: string) {
  const [row] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .returning()

  if (!row) {
    throw new AppError('Key not found', 404, 'NotFound')
  }
}
