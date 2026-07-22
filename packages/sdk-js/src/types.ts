/**
 * A single context value. Numbers, booleans and Dates are stringified by the
 * client to match how the server coerces registered context fields, so callers
 * don't have to hand-stringify.
 */
export type ContextValue = string | number | boolean | Date

export type EvaluationContext = Record<string, ContextValue>

export interface Feature {
  name: string
  enabled: boolean
}

export interface EvaluationResult {
  name: string
  enabled: boolean
  reason: 'disabled' | 'strategy-match' | 'default'
}

export interface FlagraftClientOptions {
  baseUrl: string
  apiKey: string
  /** Cache TTL in seconds. Set to 0 to disable. Defaults to 30. */
  ttl?: number
  /** Optional fetch override for testing or custom transports. */
  fetch?: typeof fetch
}
