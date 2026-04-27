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

export async function loadFlagState(
  db: Db,
  projectId: string,
  environmentId: string,
): Promise<Map<string, FlagEnvironmentState>> {
  const rows = await db
    .select({
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
      and(eq(featureFlags.projectId, projectId), eq(flagOverrides.environmentId, environmentId)),
    )
    .orderBy(flagOverrides.createdAt)

  const state = new Map<string, FlagEnvironmentState>()
  for (const row of rows) {
    state.set(row.flagKey, { enabled: row.enabled, overrides: [] })
  }

  for (const override of overrides) {
    state.get(override.flagKey)?.overrides.push({
      contextKey: override.contextKey,
      contextValue: override.contextValue,
      enabled: override.enabled,
    })
  }

  return state
}

export function evaluateAll(
  state: Map<string, FlagEnvironmentState>,
  context: EvaluationContext,
): EvaluatedFeature[] {
  return [...state.entries()].map(([name, flagState]) => ({
    name,
    ...evaluateFlag(flagState, context),
  }))
}

export async function evaluateOne(
  db: Db,
  projectId: string,
  environmentId: string,
  flagKey: string,
  context: EvaluationContext,
): Promise<EvaluatedFeature> {
  const state = await loadFlagState(db, projectId, environmentId)
  const flagState = state.get(flagKey)
  if (!flagState) {
    throw new AppError('Flag not found', 404, 'NotFound')
  }

  return { name: flagKey, ...evaluateFlag(flagState, context) }
}
