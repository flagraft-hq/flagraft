export type EnvColor = 'teal' | 'amber' | 'red' | 'slate'
export type FieldType = 'string' | 'enum' | 'boolean' | 'number' | 'version' | 'date'
export type KeyScope = 'root' | 'admin' | 'client'

export type DefaultFlagState = 'off' | 'dev' | 'on'

/** Defaults applied to newly-created flags in a project. */
export interface FlagDefaults {
  defaultState?: DefaultFlagState
  staleFlagDays?: number | null
  requireDescription?: boolean
}

/** Project-level settings bag. Groups are optional; readers fall back to defaults. */
export interface ProjectSettings {
  flagDefaults?: FlagDefaults
}

export interface Project {
  id: string
  name: string
  slug: string
  description?: string | null
  settings?: ProjectSettings
  flagCount: number
}

export interface Env {
  id: string
  slug: string
  name: string
  color: EnvColor
  protected: boolean
}

/** Key tiers the admin API can issue. The root key is CLI-managed and not listed here. */
export type ApiKeyType = 'admin' | 'client'

export interface ApiKey {
  id: string
  prefix: string
  type: ApiKeyType
  /** Set only for client keys, which are scoped to one environment. */
  environmentId: string | null
  description: string | null
  lastUsedAt: string | null
  createdAt: string
}

/** Returned only at creation — carries the plaintext key, shown to the user once. */
export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface FlagEnvState {
  on: boolean
}

/** One page of a list endpoint. Every paginated admin list uses this shape. */
export interface Page<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface Flag {
  key: string
  name: string
  description: string
  created: string
  updated: string
  state: Record<string, FlagEnvState>
  author?: string
}

export interface ContextField {
  id: string
  key: string
  type: FieldType
  description: string | null
  enumValues: string[] | null
}

/** Payload for creating a context field; `key` is omitted when updating. */
export interface ContextFieldInput {
  key: string
  type: FieldType
  description?: string
  enumValues?: string[]
}

/** One condition within a strategy. All constraints in a strategy AND together. */
export interface StrategyConstraint {
  fieldKey: string
  operator: string
  values: string[]
}

/** A targeting strategy for a flag in one environment. A match means "on". */
export interface Strategy {
  id: string
  position: number
  constraints: StrategyConstraint[]
}

export interface ApiKey {
  id: string
  label: string
  scope: KeyScope
  project?: string
  env?: string
  prefix: string
  created: string
  lastUsed: string
  createdBy: string
}

export interface AuditEntry {
  when: string
  day: string
  actor: string
  type: 'enable' | 'disable' | 'create' | 'delete' | 'override' | 'keyIssued' | 'envCreated'
  desc: string
  env: string
}

export type StateFilter = null | 'on' | 'off'
