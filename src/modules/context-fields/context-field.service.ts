import { and, asc, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { contextFields } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import { MAX_CONTEXT_FIELDS_PER_PROJECT } from '../../limits.js'
import type { CreateContextFieldInput, UpdateContextFieldInput } from './context-field.schema.js'

type ContextFieldRow = typeof contextFields.$inferSelect

/** Maps a DB row to the API response shape (drops project/timestamps). */
function toResponse(row: ContextFieldRow) {
  return {
    id: row.id,
    key: row.key,
    type: row.type,
    description: row.description,
    enumValues: row.enumValues,
  }
}

/**
 * Lists a project's context fields, ordered by key.
 */
export async function listContextFields(db: Db, projectId: string) {
  const rows = await db
    .select()
    .from(contextFields)
    .where(eq(contextFields.projectId, projectId))
    .orderBy(asc(contextFields.key))
  return rows.map(toResponse)
}

/**
 * Creates a context field. Rejects a duplicate key within the project with 409.
 */
export async function createContextField(
  db: Db,
  projectId: string,
  input: CreateContextFieldInput,
) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contextFields)
    .where(eq(contextFields.projectId, projectId))
  if (count >= MAX_CONTEXT_FIELDS_PER_PROJECT) {
    throw new AppError(
      `A project can have at most ${MAX_CONTEXT_FIELDS_PER_PROJECT} context fields. ` +
        'Delete one before adding another.',
      409,
      'Conflict',
    )
  }

  const [existing] = await db
    .select({ id: contextFields.id })
    .from(contextFields)
    .where(and(eq(contextFields.projectId, projectId), eq(contextFields.key, input.key)))
    .limit(1)
  if (existing) {
    throw new AppError('A context field with this key already exists', 409, 'Conflict')
  }

  const [row] = await db
    .insert(contextFields)
    .values({
      projectId,
      key: input.key,
      type: input.type,
      description: input.description ?? null,
      enumValues: input.enumValues ?? null,
    })
    .returning()
  return toResponse(row)
}

/**
 * Updates every mutable field of a context field. `key` is immutable and is
 * not accepted here — delete and recreate to rename.
 */
export async function updateContextField(
  db: Db,
  projectId: string,
  fieldId: string,
  input: UpdateContextFieldInput,
) {
  const [row] = await db
    .update(contextFields)
    .set({
      type: input.type,
      description: input.description ?? null,
      enumValues: input.enumValues ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(contextFields.projectId, projectId), eq(contextFields.id, fieldId)))
    .returning()
  if (!row) {
    throw new AppError('Context field not found', 404, 'NotFound')
  }
  return toResponse(row)
}

/**
 * Deletes a context field. 404 if it does not belong to the project.
 */
export async function deleteContextField(db: Db, projectId: string, fieldId: string) {
  const [row] = await db
    .delete(contextFields)
    .where(and(eq(contextFields.projectId, projectId), eq(contextFields.id, fieldId)))
    .returning()
  if (!row) {
    throw new AppError('Context field not found', 404, 'NotFound')
  }
}
