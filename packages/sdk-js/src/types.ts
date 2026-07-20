export type EvaluationContext = Record<string, string>

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
