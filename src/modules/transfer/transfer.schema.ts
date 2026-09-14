import { z } from 'zod'

import { FIELD_TYPES, contextFieldKeySchema } from '../context-fields/context-field.schema.js'

export const NATIVE_FORMAT = 'flagraft.export'
export const NATIVE_VERSION = 1

/**
 * Same rules as the create-context-field route, because an import writes to
 * the same table. `enumValues` additionally accepts null, which is what the
 * export writes for every non-enum field.
 */
export const nativeContextFieldSchema = z
  .object({
    key: contextFieldKeySchema,
    type: z.enum(FIELD_TYPES),
    description: z.string().nullable().optional(),
    enumValues: z.array(z.string().min(1)).nullable().optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'enum') {
      if (!field.enumValues || field.enumValues.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['enumValues'],
          message: 'enumValues is required and must be non-empty when type is "enum"',
        })
      }
    } else if (field.enumValues && field.enumValues.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumValues'],
        message: 'enumValues is only allowed when type is "enum"',
      })
    }
  })

const constraintSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
})

const strategySchema = z.object({
  constraints: z.array(constraintSchema).default([]),
})

const flagEnvironmentSchema = z.object({
  enabled: z.boolean(),
  strategies: z.array(strategySchema).default([]),
})

const flagSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  environments: z.record(z.string().min(1), flagEnvironmentSchema).default({}),
})

/**
 * The native transfer document.
 *
 * `version` is a literal rather than a number so a file written by a newer
 * Flagraft is refused outright instead of being half-understood.
 */
export const nativeDocumentSchema = z.object({
  format: z.literal(NATIVE_FORMAT),
  version: z.literal(NATIVE_VERSION),
  /** Informational. Ignored on import. */
  exportedAt: z.string().optional(),
  /** Informational. The import target is always the projectId in the URL. */
  project: z.object({ slug: z.string(), name: z.string() }).optional(),
  contextFields: z.array(nativeContextFieldSchema).default([]),
  flags: z.array(flagSchema).default([]),
})

export type NativeDocument = z.infer<typeof nativeDocumentSchema>
export type NativeFlag = z.infer<typeof flagSchema>
export type NativeContextField = z.infer<typeof nativeContextFieldSchema>
export type NativeStrategy = z.infer<typeof strategySchema>

export const importOptionsSchema = z.object({
  /** Parsed by the route, which knows which format it accepts. */
  document: z.unknown(),
  onConflict: z.enum(['skip', 'overwrite']).default('skip'),
  /** Maps a name in the file to a local environment slug. */
  environmentMap: z.record(z.string().min(1), z.string().min(1)).default({}),
  dryRun: z.boolean().default(false),
})

export type ImportOptions = z.infer<typeof importOptionsSchema>

export type WarningKind =
  | 'unsupported-strategy'
  | 'unsupported-operator'
  | 'unknown-environment'
  | 'approval-required'
  | 'constraint-rejected'
  | 'behaviour-change'

export interface TransferWarning {
  environment?: string
  kind: WarningKind
  detail: string
}

export interface FlagReportEntry {
  key: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
  warnings: TransferWarning[]
}

export interface ImportReport {
  dryRun: boolean
  source: 'flagraft' | 'unleash'
  counts: {
    flagsCreated: number
    flagsUpdated: number
    flagsSkipped: number
    contextFieldsCreated: number
    strategiesImported: number
    strategiesSkipped: number
  }
  contextFieldsCreated: string[]
  unmatchedEnvironments: string[]
  flags: FlagReportEntry[]
}

/** Export returns the same envelope on both routes so the UI has one shape. */
export interface ExportEnvelope<T> {
  document: T
  warnings: TransferWarning[]
}

/**
 * Turns zod issues into one sentence a person can act on.
 *
 * The raw issue array is a wall of JSON, and it used to reach the admin UI
 * verbatim. Three examples and a count is enough to find the problem in the
 * file; the whole list never helped anybody.
 */
export function summariseIssues(issues: z.ZodIssue[]): string {
  if (issues.length === 0) return 'The file does not match the expected shape.'

  const shown = issues.slice(0, 3).map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path} — ${issue.message.toLowerCase()}` : issue.message
  })
  const rest = issues.length - shown.length

  return (
    `${issues.length} problem${issues.length === 1 ? '' : 's'} in the file: ` +
    shown.join('; ') +
    (rest > 0 ? `; and ${rest} more.` : '.')
  )
}
