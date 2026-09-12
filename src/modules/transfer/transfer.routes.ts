import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { cacheKeys } from '../../cache/keys.js'
import { AppError } from '../../plugins/errorHandler.js'
import { importOptionsSchema, nativeDocumentSchema } from './transfer.schema.js'
import * as service from './transfer.service.js'

/**
 * Parses the body as a native document, and recognises the one wrong file an
 * operator is likely to reach for so the error can point at the right door.
 */
function parseNativeDocument(input: unknown) {
  const parsed = nativeDocumentSchema.safeParse(input)
  if (parsed.success) return parsed.data

  const looksLikeUnleash =
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as { features?: unknown }).features)
  if (looksLikeUnleash) {
    throw new AppError(
      'This looks like an Unleash export. Use POST /transfer/import/unleash instead.',
      400,
      'BadRequest',
    )
  }

  throw new AppError(
    `Not a flagraft.export v1 document: ${parsed.error.issues[0]?.message ?? 'unrecognised shape'}`,
    400,
    'BadRequest',
  )
}

const projectParamsSchema = z.object({ projectId: z.string().uuid() })

const exportQuerySchema = z.object({
  /** Comma-separated flag keys; absent means the whole project. */
  keys: z.string().optional(),
})

export async function transferRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/projects/:projectId/transfer/export',
    {
      preHandler: fastify.requireAdminKey,
      schema: {
        tags: ['admin'],
        description:
          "Export a project's flags, per-environment states, targeting strategies and " +
          'context fields as a flagraft.export v1 document. Carries no ids, timestamps, ' +
          'users or keys, so it can be imported into any project on any install.',
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
      const { keys } = exportQuerySchema.parse(request.query)
      const list = keys
        ?.split(',')
        .map((key) => key.trim())
        .filter(Boolean)
      return service.exportProject(fastify.db, projectId, list)
    },
  )

  fastify.post(
    '/admin/projects/:projectId/transfer/import',
    {
      preHandler: fastify.requireProjectAdmin,
      schema: {
        tags: ['admin'],
        description:
          'Import a flagraft.export v1 document into a project. One transaction: it all ' +
          'lands or none of it does. Requires the owner or admin role because an import ' +
          'rewrites flag state in every environment, protected ones included. Pass ' +
          'dryRun to get the same report without writing anything.',
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
      const document = parseNativeDocument(options.document)

      const report = await service.importProject(fastify.db, projectId, {
        document,
        source: 'flagraft',
        onConflict: options.onConflict,
        environmentMap: options.environmentMap,
        dryRun: options.dryRun,
      })

      /** A preview changed nothing, so it must not evict live cache entries. */
      if (!options.dryRun) {
        await fastify.cache.deleteByPrefix(cacheKeys.flagStatePrefix(projectId))
      }
      return { report }
    },
  )
}
