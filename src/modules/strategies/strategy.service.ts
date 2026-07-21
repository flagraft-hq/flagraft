import { and, asc, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { contextFields, environments, featureFlags, targetingStrategies } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import { OPERATORS_BY_TYPE } from './strategy.schema.js'
import type { PutStrategiesInput } from './strategy.schema.js'

type StrategyRow = typeof targetingStrategies.$inferSelect

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

/** Response shape: order is carried by `position`. */
function toResponse(row: StrategyRow) {
  return { id: row.id, position: row.position, constraints: row.constraints }
}

export async function listStrategies(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
) {
  const flag = await findFlag(db, projectId, flagKey)
  const environment = await findEnvironment(db, projectId, environmentSlug)
  const rows = await db
    .select()
    .from(targetingStrategies)
    .where(
      and(
        eq(targetingStrategies.flagId, flag.id),
        eq(targetingStrategies.environmentId, environment.id),
      ),
    )
    .orderBy(asc(targetingStrategies.position))
  return rows.map(toResponse)
}

/**
 * Validates every constraint against the project's registered context fields:
 * the field must exist, the operator must be legal for its type, and enum
 * values must be within the field's allowed set.
 */
async function validateConstraints(db: Db, projectId: string, input: PutStrategiesInput) {
  const fields = await db
    .select({
      key: contextFields.key,
      type: contextFields.type,
      enumValues: contextFields.enumValues,
    })
    .from(contextFields)
    .where(eq(contextFields.projectId, projectId))
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const operatorsByType = OPERATORS_BY_TYPE as Record<string, readonly string[]>

  for (const strategy of input.strategies) {
    for (const c of strategy.constraints) {
      const field = byKey.get(c.fieldKey)
      if (!field) {
        throw new AppError(`Unknown context field: "${c.fieldKey}"`, 400, 'BadRequest')
      }
      const allowed = operatorsByType[field.type] ?? []
      if (!allowed.includes(c.operator)) {
        throw new AppError(
          `Operator "${c.operator}" is not valid for ${field.type} field "${c.fieldKey}"`,
          400,
          'BadRequest',
        )
      }
      if (field.type === 'enum' && field.enumValues) {
        for (const v of c.values) {
          if (!field.enumValues.includes(v)) {
            throw new AppError(
              `Value "${v}" is not an allowed value for "${c.fieldKey}"`,
              400,
              'BadRequest',
            )
          }
        }
      }
    }
  }
}

/**
 * Replaces the entire ordered strategy list for a flag+environment.
 * `position` is assigned from the array order.
 */
export async function replaceStrategies(
  db: Db,
  projectId: string,
  flagKey: string,
  environmentSlug: string,
  input: PutStrategiesInput,
) {
  const flag = await findFlag(db, projectId, flagKey)
  const environment = await findEnvironment(db, projectId, environmentSlug)
  await validateConstraints(db, projectId, input)

  const rows = await db.transaction(async (tx) => {
    await tx
      .delete(targetingStrategies)
      .where(
        and(
          eq(targetingStrategies.flagId, flag.id),
          eq(targetingStrategies.environmentId, environment.id),
        ),
      )
    if (input.strategies.length === 0) {
      return []
    }
    return tx
      .insert(targetingStrategies)
      .values(
        input.strategies.map((strategy, index) => ({
          flagId: flag.id,
          environmentId: environment.id,
          position: index,
          constraints: strategy.constraints,
        })),
      )
      .returning()
  })

  return rows.map(toResponse)
}
