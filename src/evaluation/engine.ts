export interface EvaluationContext {
  userId?: string
  sessionId?: string
  [key: string]: string | undefined
}

export interface FlagOverride {
  contextKey: string
  contextValue: string
  enabled: boolean
}

export interface FlagEnvironmentState {
  enabled: boolean
  overrides: FlagOverride[]
}

export interface EvaluationResult {
  enabled: boolean
  reason: 'override' | 'default'
}

export function evaluateFlag(
  state: FlagEnvironmentState,
  context: EvaluationContext
): EvaluationResult {
  for (const override of state.overrides) {
    const ctxValue = context[override.contextKey]
    if (ctxValue !== undefined && ctxValue === override.contextValue) {
      return { enabled: override.enabled, reason: 'override' }
    }
  }

  return { enabled: state.enabled, reason: 'default' }
}
