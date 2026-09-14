import { and, asc, eq, inArray } from 'drizzle-orm'

import type { Db, DbLike } from '../../db/index.js'
import { AppError } from '../../plugins/errorHandler.js'
import { initialEnabled } from '../flags/flag.service.js'
import { constraintError, type FieldRule } from '../strategies/constraint-rules.js'
import { loadFieldRules } from '../strategies/strategy.service.js'
import {
  contextFields,
  environments,
  featureFlags,
  flagEnvironments,
  projects,
  targetingStrategies,
} from '../../db/schema.js'
import { MAX_CONTEXT_FIELDS_PER_PROJECT } from '../../limits.js'
import {
  NATIVE_FORMAT,
  NATIVE_VERSION,
  nativeContextFieldSchema,
  summariseIssues,
  type ExportEnvelope,
  type FlagReportEntry,
  type ImportReport,
  type NativeDocument,
  type NativeStrategy,
  type TransferWarning,
} from './transfer.schema.js'

type NativeEnvironments = NativeDocument['flags'][number]['environments']
type NativeFieldType = NativeDocument['contextFields'][number]['type']

/**
 * Builds the native transfer document for a project.
 *
 * Rows come out ordered by key and slug so two exports of the same data are
 * identical, which is what lets the round-trip test be a plain deep equality
 * check rather than a fuzzy comparison.
 */
export async function exportProject(
  db: Db,
  projectId: string,
  keys?: string[],
): Promise<ExportEnvelope<NativeDocument>> {
  const [project] = await db
    .select({ slug: projects.slug, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project) {
    throw new AppError('Project not found', 404, 'NotFound')
  }

  const fieldRows = await db
    .select()
    .from(contextFields)
    .where(eq(contextFields.projectId, projectId))
    .orderBy(asc(contextFields.key))

  const flagFilters = [eq(featureFlags.projectId, projectId)]
  if (keys && keys.length > 0) {
    flagFilters.push(inArray(featureFlags.key, keys))
  }
  const flagRows = await db
    .select({
      id: featureFlags.id,
      key: featureFlags.key,
      name: featureFlags.name,
      description: featureFlags.description,
    })
    .from(featureFlags)
    .where(and(...flagFilters))
    .orderBy(asc(featureFlags.key))

  const flagIds = flagRows.map((flag) => flag.id)

  const stateRows = flagIds.length
    ? await db
        .select({
          flagId: flagEnvironments.flagId,
          slug: environments.slug,
          enabled: flagEnvironments.enabled,
        })
        .from(flagEnvironments)
        .innerJoin(environments, eq(flagEnvironments.environmentId, environments.id))
        .where(inArray(flagEnvironments.flagId, flagIds))
        .orderBy(asc(environments.slug))
    : []

  const strategyRows = flagIds.length
    ? await db
        .select({
          flagId: targetingStrategies.flagId,
          slug: environments.slug,
          constraints: targetingStrategies.constraints,
        })
        .from(targetingStrategies)
        .innerJoin(environments, eq(targetingStrategies.environmentId, environments.id))
        .where(inArray(targetingStrategies.flagId, flagIds))
        .orderBy(asc(environments.slug), asc(targetingStrategies.position))
    : []

  const document: NativeDocument = {
    format: NATIVE_FORMAT,
    version: NATIVE_VERSION,
    exportedAt: new Date().toISOString(),
    project: { slug: project.slug, name: project.name },
    contextFields: fieldRows.map((field) => ({
      key: field.key,
      type: field.type as NativeFieldType,
      description: field.description,
      enumValues: field.enumValues,
    })),
    flags: flagRows.map((flag) => {
      const envs: NativeEnvironments = {}
      for (const state of stateRows) {
        if (state.flagId !== flag.id) continue
        envs[state.slug] = { enabled: state.enabled, strategies: [] }
      }
      for (const strategy of strategyRows) {
        if (strategy.flagId !== flag.id) continue
        /** A strategy only exists for an environment the flag has a row in. */
        envs[strategy.slug]?.strategies.push({ constraints: strategy.constraints })
      }
      return {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        environments: envs,
      }
    }),
  }

  return { document, warnings: [] }
}

/* ── Import ──────────────────────────────────────────────────────────────── */

/** Thrown to unwind a dry run's transaction; carries the report out with it. */
class DryRunComplete extends Error {
  constructor(readonly report: ImportReport) {
    super('dry run')
  }
}

export interface ImportArgs {
  document: NativeDocument
  source: ImportReport['source']
  onConflict: 'skip' | 'overwrite'
  environmentMap: Record<string, string>
  dryRun: boolean
  /** Warnings an adapter produced while building the document, by flag key. */
  seedWarnings?: Map<string, TransferWarning[]>
}

interface LocalEnvironment {
  id: string
  slug: string
  protected: boolean
}

/**
 * Applies a native document to a project inside one transaction.
 *
 * Both import routes end up here: the Unleash route converts its file to a
 * native document first. Everything that decides what actually changes --
 * conflicts, environment matching, the report -- lives in this one place so
 * the two routes cannot grow different semantics.
 */
export async function importProject(
  db: Db,
  projectId: string,
  args: ImportArgs,
): Promise<ImportReport> {
  try {
    return await db.transaction(async (tx) => {
      const report = await applyImport(tx, projectId, args)
      if (args.dryRun) {
        throw new DryRunComplete(report)
      }
      return report
    })
  } catch (error) {
    if (error instanceof DryRunComplete) {
      return error.report
    }
    throw error
  }
}

/**
 * Resolves an environment name from the file to a local environment.
 *
 * The explicit map wins, then an exact slug match. Anything else is reported
 * rather than created: a new environment needs its own API keys and its own
 * protection setting, so a typo in a file must not grow the list.
 */
function resolveEnvironment(
  name: string,
  environmentMap: Record<string, string>,
  envBySlug: Map<string, LocalEnvironment>,
): LocalEnvironment | undefined {
  return envBySlug.get(environmentMap[name] ?? name)
}

/**
 * Keeps only the strategies whose every constraint is legal.
 *
 * A strategy is an AND of constraints, so dropping one constraint widens who
 * the flag is on for -- a strategy scoped to one plan would become
 * match-everybody. So the whole strategy goes, and the report says why.
 */
function filterStrategies(
  strategies: NativeStrategy[],
  fields: Map<string, FieldRule>,
  environment: string,
  warnings: TransferWarning[],
) {
  const kept: NativeStrategy[] = []
  let skipped = 0

  for (const strategy of strategies) {
    const reason = strategy.constraints
      .map((constraint) => constraintError(fields, constraint))
      .find((result): result is string => result !== null)
    if (reason) {
      warnings.push({
        environment,
        kind: 'constraint-rejected',
        detail: `Strategy dropped: ${reason}. Rebuild it by hand rather than importing a wider rule.`,
      })
      skipped += 1
      continue
    }
    kept.push(strategy)
  }

  return { kept, skipped }
}

async function applyImport(tx: DbLike, projectId: string, args: ImportArgs): Promise<ImportReport> {
  const { document, onConflict, environmentMap } = args

  const [project] = await tx
    .select({ settings: projects.settings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project) {
    throw new AppError('Project not found', 404, 'NotFound')
  }
  const flagDefaults = project.settings.flagDefaults ?? {}
  const approvalRequired = project.settings.security?.requireApprovalInProd === true

  const envRows: LocalEnvironment[] = await tx
    .select({
      id: environments.id,
      slug: environments.slug,
      protected: environments.protected,
    })
    .from(environments)
    .where(eq(environments.projectId, projectId))
  const envBySlug = new Map(envRows.map((env) => [env.slug, env]))

  const report: ImportReport = {
    dryRun: args.dryRun,
    source: args.source,
    counts: {
      flagsCreated: 0,
      flagsUpdated: 0,
      flagsSkipped: 0,
      contextFieldsCreated: 0,
      strategiesImported: 0,
      strategiesSkipped: 0,
    },
    contextFieldsCreated: [],
    unmatchedEnvironments: [],
    flags: [],
  }

  /** Context fields: create what is missing, never touch what already exists. */
  const fields = await loadFieldRules(tx, projectId)
  const newFields = document.contextFields.filter((field) => !fields.has(field.key))

  /**
   * The same ceiling the create route enforces. This writes to `context_fields`
   * directly, so without this an import is a way past a limit the rest of the
   * app keeps -- and a project that lands over the limit cannot be edited back
   * under it one field at a time.
   */
  if (fields.size + newFields.length > MAX_CONTEXT_FIELDS_PER_PROJECT) {
    throw new AppError(
      `This import would leave the project with ${fields.size + newFields.length} context ` +
        `fields; the limit is ${MAX_CONTEXT_FIELDS_PER_PROJECT}. Remove fields from the file ` +
        'or delete some here first.',
      409,
      'Conflict',
    )
  }

  for (const field of newFields) {
    /**
     * Belt and braces: both import routes validate before they get here, so a
     * field that fails now is a bug rather than a bad file. It still must not
     * reach the table -- this is the only place either route writes one.
     */
    const parsed = nativeContextFieldSchema.safeParse(field)
    if (!parsed.success) {
      throw new AppError(
        `Context field "${field.key}" cannot be created: ${summariseIssues(parsed.error.issues)}`,
        400,
        'BadRequest',
      )
    }
    const enumValues = field.type === 'enum' ? (field.enumValues ?? []) : null
    await tx.insert(contextFields).values({
      projectId,
      key: field.key,
      type: field.type,
      description: field.description ?? null,
      enumValues,
    })
    fields.set(field.key, { key: field.key, type: field.type, enumValues })
    report.contextFieldsCreated.push(field.key)
    report.counts.contextFieldsCreated += 1
  }

  /**
   * One lookup for every key in the document rather than one per flag. A key
   * that appears twice in the file is therefore not seen as pre-existing on
   * its second pass, and the unique index rejects it mid-transaction -- which
   * rolls the whole import back, including the context fields above.
   */
  const documentKeys = document.flags.map((flag) => flag.key)
  const existingRows = documentKeys.length
    ? await tx
        .select({ id: featureFlags.id, key: featureFlags.key })
        .from(featureFlags)
        .where(and(eq(featureFlags.projectId, projectId), inArray(featureFlags.key, documentKeys)))
    : []
  const existingByKey = new Map(existingRows.map((row) => [row.key, row.id]))

  const unmatched = new Set<string>()

  for (const flag of document.flags) {
    const entry: FlagReportEntry = {
      key: flag.key,
      action: 'created',
      warnings: [...(args.seedWarnings?.get(flag.key) ?? [])],
    }
    /**
     * Strategies an adapter dropped before the document ever got here still
     * count as skipped. Without this the report showed "0 dropped" above a
     * list of everything it had dropped.
     */
    report.counts.strategiesSkipped += entry.warnings.filter(
      (warning) => warning.kind === 'unsupported-strategy',
    ).length
    const existingId = existingByKey.get(flag.key)

    if (existingId && onConflict === 'skip') {
      entry.action = 'skipped'
      entry.reason = 'exists (onConflict=skip)'
      report.counts.flagsSkipped += 1
      report.flags.push(entry)
      continue
    }

    /**
     * Which environments this document has something to say about, paired
     * with the local environment they land in. An unresolved name is reported
     * and its state and strategies are dropped; the flag itself still lands.
     */
    const targets: {
      name: string
      env: LocalEnvironment
      enabled: boolean
      strategies: NativeStrategy[]
    }[] = []
    for (const [name, state] of Object.entries(flag.environments)) {
      const env = resolveEnvironment(name, environmentMap, envBySlug)
      if (!env) {
        unmatched.add(name)
        entry.warnings.push({
          environment: name,
          kind: 'unknown-environment',
          detail: `No environment "${name}" in this project. Its state and strategies were skipped; create the environment or pass environmentMap.`,
        })
        continue
      }
      targets.push({ name, env, enabled: state.enabled, strategies: state.strategies })
    }

    /**
     * A protected environment behind the two-admin approval flow must not be
     * flipped by a file. The flag still imports; only its state is left alone.
     */
    const writable = targets.filter((target) => {
      if (!approvalRequired || !target.env.protected) return true
      entry.warnings.push({
        environment: target.env.slug,
        kind: 'approval-required',
        detail: `"${target.env.slug}" is protected and this project requires a second admin to confirm a toggle. Its state was left unchanged; toggle it by hand.`,
      })
      return false
    })
    const enabledBySlug = new Map(writable.map((target) => [target.env.slug, target.enabled]))

    let flagId: string
    if (existingId) {
      flagId = existingId
      entry.action = 'updated'
      report.counts.flagsUpdated += 1
      await tx
        .update(featureFlags)
        .set({ name: flag.name, description: flag.description ?? null, updatedAt: new Date() })
        .where(eq(featureFlags.id, flagId))
      for (const target of writable) {
        await tx
          .update(flagEnvironments)
          .set({ enabled: target.enabled, updatedAt: new Date() })
          .where(
            and(
              eq(flagEnvironments.flagId, flagId),
              eq(flagEnvironments.environmentId, target.env.id),
            ),
          )
      }
    } else {
      const [created] = await tx
        .insert(featureFlags)
        .values({
          projectId,
          key: flag.key,
          name: flag.name,
          description: flag.description ?? null,
        })
        .returning({ id: featureFlags.id })
      flagId = created.id
      report.counts.flagsCreated += 1
      /**
       * Every environment gets a row, exactly as createFlag does. Ones the
       * document is silent about (or was refused) take the project default
       * rather than being left without a row.
       */
      if (envRows.length > 0) {
        await tx.insert(flagEnvironments).values(
          envRows.map((env) => ({
            flagId,
            environmentId: env.id,
            enabled:
              enabledBySlug.get(env.slug) ??
              initialEnabled(flagDefaults.defaultState, env.slug, env.protected, false),
          })),
        )
      }
    }

    /**
     * Strategies are replaced wholesale for every environment the document
     * describes, matching how PUT .../strategies behaves. They are not behind
     * the approval flow, so a refused toggle does not refuse them.
     */
    for (const target of targets) {
      const { kept, skipped } = filterStrategies(
        target.strategies,
        fields,
        target.env.slug,
        entry.warnings,
      )
      report.counts.strategiesSkipped += skipped

      if (existingId) {
        await tx
          .delete(targetingStrategies)
          .where(
            and(
              eq(targetingStrategies.flagId, flagId),
              eq(targetingStrategies.environmentId, target.env.id),
            ),
          )
      }
      if (kept.length === 0) continue
      await tx.insert(targetingStrategies).values(
        kept.map((strategy, index) => ({
          flagId,
          environmentId: target.env.id,
          position: index,
          constraints: strategy.constraints,
        })),
      )
      report.counts.strategiesImported += kept.length
    }

    report.flags.push(entry)
  }

  report.unmatchedEnvironments = [...unmatched].sort()
  return report
}
