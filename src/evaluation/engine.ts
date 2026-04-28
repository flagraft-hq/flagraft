/**
 * Contextual data used to evaluate feature flags
 */
export interface EvaluationContext {
  userId?: string
  sessionId?: string
  [key: string]: string | undefined
}

/**
 * A specific override for a flag based on context matching
 */
export interface FlagOverride {
  contextKey: string
  contextValue: string
  enabled: boolean
}

/**
 * The state of a flag within a specific environment
 */
export interface FlagEnvironmentState {
  enabled: boolean
  overrides: FlagOverride[]
}

/**
 * The outcome of a flag evaluation
 */
export interface EvaluationResult {
  enabled: boolean
  reason: 'override' | 'default'
}

/**
 * Evaluates a feature flag based on the environment state and provided context
 */
export function evaluateFlag(
  state: FlagEnvironmentState,
  context: EvaluationContext,
): EvaluationResult {
  for (const override of state.overrides) {
    const ctxValue = context[override.contextKey]
    if (ctxValue !== undefined && ctxValue === override.contextValue) {
      return { enabled: override.enabled, reason: 'override' }
    }
  }

  return { enabled: state.enabled, reason: 'default' }
}
