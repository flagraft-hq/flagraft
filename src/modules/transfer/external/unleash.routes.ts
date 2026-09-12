import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { cacheKeys } from '../../../cache/keys.js'
import { AppError } from '../../../plugins/errorHandler.js'
import { importOptionsSchema } from '../transfer.schema.js'
import * as service from '../transfer.service.js'
import { fromNative, toNative } from './unleash.adapter.js'

const projectParamsSchema = z.object({ projectId: z.string().uuid() })

/**
 * Parses the body as an Unleash export, with the mirror of the hint the native
 * route gives: an operator who reached for the wrong door is told which one.
 */
function parseUnleashDocument(input: unknown) {
  const looksNative =
    typeof input === 'object' &&
    input !== null &&
    (input as { format?: unknown }).format === 'flagraft.export'
  if (looksNative) {
    throw new AppError(
      'This is a Flagraft export. Use POST /transfer/import instead.',
      400,
      'BadRequest',
    )
  }

  try {
    return toNative(input)
  } catch (error) {
    throw new AppError(
      `Not an Unleash export: ${error instanceof Error ? error.message : 'unrecognised shape'}`,
      400,
      'BadRequest',
    )
  }
}

export async function unleashRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/projects/:projectId/transfer/import/unleash',
    {
      preHandler: fastify.requireProjectAdmin,
      schema: {
        tags: ['admin'],
        description:
          'Import an Unleash export (POST /api/admin/features-batch/export). Anything ' +
          'Unleash can express and Flagraft cannot -- percentage rollouts, variants, ' +
          'segments, inverted constraints -- is reported rather than approximated, and ' +
          'the strategy carrying it is dropped whole so targeting never widens. Pass ' +
          'dryRun to see the report without writing anything.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
    },
    async (request) => {
      const { projectId } = projectParamsSchema.parse(request.params)
      const options = importOptionsSchema.parse(request.body)
      const { document, warnings, flagWarnings } = parseUnleashDocument(options.document)

      const report = await service.importProject(fastify.db, projectId, {
        document,
        source: 'unleash',
        onConflict: options.onConflict,
        environmentMap: options.environmentMap,
        dryRun: options.dryRun,
        seedWarnings: flagWarnings,
      })

      if (!options.dryRun) {
        await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(projectId))
      }
      return { report, warnings }
    },
  )

  fastify.get(
    '/admin/projects/:projectId/transfer/export/unleash',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description:
          "Export a project's flags in Unleash's import shape. Constraints Unleash has " +
          'no operator for (regex, neq, semver ranges) cannot be carried, so the ' +
          'strategies using them are omitted and named in `warnings`.',
        params: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
        querystring: {
          type: 'object',
          properties: { keys: { type: 'string' } },
        },
      },
    },
    async (request) => {
      const { projectId } = projectParamsSchema.parse(request.params)
      const { keys } = z.object({ keys: z.string().optional() }).parse(request.query)
      const list = keys
        ?.split(',')
        .map((key) => key.trim())
        .filter(Boolean)
      const native = await service.exportProject(fastify.db, projectId, list)
      return fromNative(native.document)
    },
  )
}
