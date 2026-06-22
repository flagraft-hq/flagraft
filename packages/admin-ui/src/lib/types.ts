export type EnvColor = 'teal' | 'amber' | 'red' | 'slate'
export type FieldType = 'string' | 'enum' | 'boolean' | 'number' | 'version' | 'date'
export type FieldSource = 'sdk' | 'server' | 'computed'
export type KeyScope = 'root' | 'admin' | 'client'

export interface Project {
  id: string
  name: string
  slug: string
  flagCount: number
}

export interface Env {
  id: string
  slug: string
  name: string
  color: EnvColor
  protected: boolean
}

export interface FlagEnvState {
  on: boolean
  overrides: number
}

export interface Flag {
  key: string
  name: string
  description: string
  tags: string[]
  created: string
  updated: string
  state: Record<string, FlagEnvState>
  author?: string
}

export interface Override {
  id: string
  flag: string
  env: string
  key: string
  op: string
  val: string
  result: boolean
  note: string
  created: string
}

export interface ContextField {
  key: string
  type: FieldType
  source: FieldSource
  required: boolean
  example: string
  desc: string
  enumValues?: string[]
  usedIn: number
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

export type Operator =
  | 'equals'
  | 'in'
  | 'startsWith'
  | 'contains'
  | 'regex'
  | 'is'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'satisfies'
  | 'before'
  | 'after'

export interface OperatorOption {
  value: Operator
  label: string
}

export const OPS_BY_TYPE: Record<FieldType, OperatorOption[]> = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'in', label: 'in' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'contains', label: 'contains' },
    { value: 'regex', label: 'regex' },
  ],
  enum: [
    { value: 'equals', label: 'equals' },
    { value: 'in', label: 'in' },
  ],
  boolean: [{ value: 'is', label: 'is' }],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
  ],
  version: [
    { value: 'eq', label: '=' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'satisfies', label: 'satisfies' },
  ],
  date: [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
  ],
}

export type StateFilter = null | 'on' | 'off' | 'overrides' | 'kill-switch'
