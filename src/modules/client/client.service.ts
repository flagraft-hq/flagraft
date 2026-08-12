import { createHash } from 'node:crypto'

import { and, asc, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import {
  contextFields,
  environments,
  featureFlags,
  flagEnvironments,
  targetingStrategies,
} from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'
import type { EvalContext, EvalReason, FieldTypes, FlagState } from './evaluate.js'
import { evaluateFlag } from './evaluate.js'

/**
 * Everything needed to evaluate any flag in a project+environment: each flag's
 * enabled state and strategies, plus the project's field types (for coercing
 * context values during matching). Plain JSON so it caches directly.
 */
export interface EnvState {
  flags: Record<string, FlagState>
  fieldTypes: FieldTypes
  /**
   * Fingerprint of everything above. Two servers loading the same rows produce
   * the same value, so it works as an ETag behind a load balancer, and it
   * changes whenever a flag, its strategies or a field type change.
   */
  version: string
}

/**
 * Hashes the state with its keys sorted, because the database does not promise
 * a row order and an unsorted hash would change for identical data.
 */
function fingerprint(flags: Record<string, FlagState>, fieldTypes: FieldTypes): string {
  const canonical = JSON.stringify({
    flags: Object.keys(flags)
      .sort()
      .map((key) => [key, flags[key]]),
    fieldTypes: Object.keys(fieldTypes)
      .sort()
      .map((key) => [key, fieldTypes[key]]),
  })
  return createHash('sha1').update(canonical).digest('base64url')
}

/**
 * Builds the ETag for one evaluation response. The body depends on the flag
 * state and on the caller's context, so both go into the tag.
 */
export function etagFor(state: EnvState, context: EvalContext): string {
  const canonicalContext = Object.keys(context)
    .sort()
    .map((key) => `${key}=${context[key]}`)
    .join('&')
  return `"${createHash('sha1').update(`${state.version}|${canonicalContext}`).digest('base64url')}"`
}

export interface EvaluatedFeature {
  name: string
  enabled: boolean
  reason: EvalReason
}

/**
 * Loads flags (+ enabled + strategies) and the context-field type map for one
 * project environment.
 */
export async function loadEnvState(
  db: Db,
  projectId: string,
  environmentId: string,
): Promise<EnvState> {
  const flagRows = await db
    .select({
      flagId: featureFlags.id,
      flagKey: featureFlags.key,
      enabled: flagEnvironments.enabled,
    })
    .from(flagEnvironments)
    .innerJoin(featureFlags, eq(featureFlags.id, flagEnvironments.flagId))
    .innerJoin(environments, eq(environments.id, flagEnvironments.environmentId))
    .where(
      and(
        eq(featureFlags.projectId, projectId),
        eq(environments.projectId, projectId),
        eq(flagEnvironments.environmentId, environmentId),
      ),
    )

  const strategyRows = await db
    .select({
      flagId: targetingStrategies.flagId,
      constraints: targetingStrategies.constraints,
    })
    .from(targetingStrategies)
    .innerJoin(featureFlags, eq(featureFlags.id, targetingStrategies.flagId))
    .where(
      and(
        eq(featureFlags.projectId, projectId),
        eq(targetingStrategies.environmentId, environmentId),
      ),
    )
    .orderBy(asc(targetingStrategies.position))

  const strategiesByFlag: Record<string, FlagState['strategies']> = {}
  for (const row of strategyRows) {
    ;(strategiesByFlag[row.flagId] ??= []).push({ constraints: row.constraints })
  }

  const fieldRows = await db
    .select({ key: contextFields.key, type: contextFields.type })
    .from(contextFields)
    .where(eq(contextFields.projectId, projectId))
  const fieldTypes: FieldTypes = {}
  for (const f of fieldRows) fieldTypes[f.key] = f.type

  const flags: Record<string, FlagState> = {}
  for (const row of flagRows) {
    flags[row.flagKey] = {
      enabled: row.enabled,
      strategies: strategiesByFlag[row.flagId] ?? [],
    }
  }

  return { flags, fieldTypes, version: fingerprint(flags, fieldTypes) }
}

export function evaluateAll(
  state: EnvState,
  context: EvalContext,
): Array<{ name: string; enabled: boolean }> {
  return Object.entries(state.flags).map(([name, flagState]) => ({
    name,
    enabled: evaluateFlag(flagState, state.fieldTypes, context).enabled,
  }))
}

export function evaluateOne(
  state: EnvState,
  flagKey: string,
  context: EvalContext,
): EvaluatedFeature {
  const flagState = state.flags[flagKey]
  if (!flagState) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
  const { enabled, reason } = evaluateFlag(flagState, state.fieldTypes, context)
  return { name: flagKey, enabled, reason }
}
