import { z } from 'zod'

/**
 * The subset of an Unleash export we actually read.
 *
 * Modelled after the document `POST /api/admin/features-batch/export` returns
 * on Unleash v5 and v6, which is also what its own import accepts. Unknown
 * keys pass through untouched: Unleash adds fields between minor releases and
 * an import must not break over one we never look at.
 */
const constraintSchema = z.object({
  contextName: z.string().min(1),
  operator: z.string().min(1),
  values: z.array(z.string()).default([]),
  /** Single-value operators use this instead of `values`. */
  value: z.string().optional(),
  caseInsensitive: z.boolean().optional(),
  inverted: z.boolean().optional(),
})

const featureSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string().optional(),
  project: z.string().optional(),
  stale: z.boolean().optional(),
  impressionData: z.boolean().optional(),
  archived: z.boolean().optional(),
})

const featureEnvironmentSchema = z.object({
  featureName: z.string().min(1),
  environment: z.string().min(1),
  enabled: z.boolean(),
  variants: z.array(z.unknown()).default([]),
})

const featureStrategySchema = z.object({
  featureName: z.string().min(1),
  environment: z.string().min(1),
  strategyName: z.string().min(1),
  sortOrder: z.number().optional(),
  disabled: z.boolean().optional(),
  parameters: z.record(z.string(), z.string()).default({}),
  constraints: z.array(constraintSchema).default([]),
  variants: z.array(z.unknown()).default([]),
  /** Segment ids. A strategy that references one cannot be represented. */
  segments: z.array(z.union([z.number(), z.string()])).default([]),
})

const contextFieldSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  legalValues: z.array(z.object({ value: z.string() })).default([]),
})

export const unleashDocumentSchema = z.object({
  features: z.array(featureSchema),
  featureEnvironments: z.array(featureEnvironmentSchema).default([]),
  featureStrategies: z.array(featureStrategySchema).default([]),
  contextFields: z.array(contextFieldSchema).default([]),
  featureTags: z.array(z.unknown()).default([]),
  segments: z.array(z.unknown()).default([]),
  tagTypes: z.array(z.unknown()).default([]),
  dependencies: z.array(z.unknown()).default([]),
})

export type UnleashDocument = z.infer<typeof unleashDocumentSchema>
export type UnleashConstraint = z.infer<typeof constraintSchema>
export type UnleashContextField = z.infer<typeof contextFieldSchema>
export type UnleashStrategy = z.infer<typeof featureStrategySchema>
