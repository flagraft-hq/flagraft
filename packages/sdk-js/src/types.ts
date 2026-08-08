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

export interface StaleEvent {
  /** The flag that was served stale, or null when the whole feature list was. */
  flagKey: string | null
  /** When the served value was fetched from the server. */
  fetchedAt: Date
}

export interface FlagraftClientOptions {
  baseUrl: string
  apiKey: string
  /** Cache TTL in seconds. Set to 0 to disable. Defaults to 30. */
  ttl?: number
  /**
   * How long an expired value stays usable as a fallback once the server
   * cannot be reached, in seconds. Set to 0 to turn the fallback off.
   * Defaults to 300.
   */
  staleTtl?: number
  /**
   * Called whenever a stale value is served, so the host application can log
   * it or emit a metric. Falls back to console.warn when not provided.
   */
  onStale?: (event: StaleEvent) => void
  /** Optional fetch override for testing or custom transports. */
  fetch?: typeof fetch
}
