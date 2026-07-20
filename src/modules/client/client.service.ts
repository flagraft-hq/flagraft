import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, featureFlags, flagEnvironments } from '../../db/schema.js'
import { AppError } from '../../plugins/errorHandler.js'

/**
 * The state of a flag within a specific environment
 */
export interface FlagState {
  enabled: boolean
}

export interface EvaluatedFeature {
  name: string
  enabled: boolean
  reason: 'default'
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
): Promise<Record<string, FlagState>> {
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

  const state: Record<string, FlagState> = {}
  for (const row of rows) {
    state[row.flagKey] = { enabled: row.enabled }
  }
  return state
}

export function evaluateAll(
  state: Record<string, FlagState>,
): Array<{ name: string; enabled: boolean }> {
  return Object.entries(state).map(([name, flagState]) => ({
    name,
    enabled: flagState.enabled,
  }))
}

export function evaluateOne(state: Record<string, FlagState>, flagKey: string): EvaluatedFeature {
  const flagState = state[flagKey]
  if (!flagState) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }
  return { name: flagKey, enabled: flagState.enabled, reason: 'default' }
}
