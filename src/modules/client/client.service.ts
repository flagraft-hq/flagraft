import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, featureFlags, flagEnvironments, flagOverrides } from '../../db/schema.js'
import {
  evaluateFlag,
  type EvaluationContext,
  type EvaluationResult,
  type FlagEnvironmentState,
} from '../../evaluation/engine.js'
import { AppError } from '../../plugins/errorHandler.js'

export interface EvaluatedFeature extends EvaluationResult {
  name: string
}

/**
 * Loads the state of all feature flags for a project environment.
 *
 * Returns a plain Record rather than a Map so callers can pass the result
 * directly to cache layers (which serialize via JSON) without a conversion step.
 */
export async function loadFlagState(
  db: Db,
  projectId: string,
  environmentId: string,
): Promise<Record<string, FlagEnvironmentState>> {
  const rows = await db
    .select({ flagKey: featureFlags.key, enabled: flagEnvironments.enabled })
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

  const overrides = await db
    .select({
      flagKey: featureFlags.key,
      contextKey: flagOverrides.contextKey,
      contextValue: flagOverrides.contextValue,
      enabled: flagOverrides.enabled,
    })
    .from(flagOverrides)
    .innerJoin(featureFlags, eq(featureFlags.id, flagOverrides.flagId))
    .where(
      and(
        eq(featureFlags.projectId, projectId),
        eq(flagOverrides.environmentId, environmentId),
      ),
    )
    .orderBy(flagOverrides.createdAt)

  const state: Record<string, FlagEnvironmentState> = {}
  for (const row of rows) {
    state[row.flagKey] = { enabled: row.enabled, overrides: [] }
  }
  for (const override of overrides) {
    state[override.flagKey]?.overrides.push({
      contextKey: override.contextKey,
      contextValue: override.contextValue,
      enabled: override.enabled,
    })
  }
  return state
}

export function evaluateAll(
  state: Record<string, FlagEnvironmentState>,
  context: EvaluationContext,
): Array<{ name: string; enabled: boolean }> {
  return Object.entries(state).map(([name, flagState]) => ({
    name,
    enabled: evaluateFlag(flagState, context).enabled,
  }))
}

export function evaluateOne(
  state: Record<string, FlagEnvironmentState>,
  flagKey: string,
  context: EvaluationContext,
): EvaluatedFeature {
  const flagState = state[flagKey]
  if (!flagState) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
  return { name: flagKey, ...evaluateFlag(flagState, context) }
}
