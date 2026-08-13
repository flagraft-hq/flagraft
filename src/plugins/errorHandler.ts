import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
  }
}

function isPgUniqueError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

/**
 * Fastify raises these when a request fails a route's own JSON schema, before
 * any handler runs. They are the caller's fault, so they must not fall through
 * to the catch-all 500 below.
 */
function isSchemaValidationError(error: unknown): error is FastifyError {
  return (
    typeof error === 'object' && error !== null && Array.isArray((error as FastifyError).validation)
  )
}

interface ErrorResponse {
  statusCode: number
  body: { error: string; message: string; statusCode: number; issues?: ZodError['issues'] }
}

/**
 * Maps a thrown error to the response the caller gets. Kept separate from the
 * handler so the status is known before the reply is sent, which is what
 * decides how loudly the error is logged.
 */
function toResponse(error: FastifyError | Error): ErrorResponse {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: 'ValidationError',
        message: 'Validation error',
        statusCode: 400,
        issues: error.issues,
      },
    }
  }

  if (isPgUniqueError(error)) {
    return {
      statusCode: 409,
      body: { error: 'Conflict', message: 'Resource already exists', statusCode: 409 },
    }
  }

  if (isSchemaValidationError(error)) {
    return {
      statusCode: 400,
      body: { error: 'ValidationError', message: error.message, statusCode: 400 },
    }
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.code, message: error.message, statusCode: error.statusCode },
    }
  }

  return {
    statusCode: 500,
    body: { error: 'InternalServerError', message: 'Internal error', statusCode: 500 },
  }
}

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const { statusCode, body } = toResponse(error)

      /**
       * The caller is told nothing about a 500 beyond "Internal error", so
       * this line is the only record of what actually happened. A 4xx is the
       * caller's own mistake and is already visible in their response, so it
       * stays at debug rather than filling the log with other people's typos.
       */
      if (statusCode >= 500) {
        request.log.error(
          { err: error, req: { method: request.method, url: request.url } },
          error.message,
        )
      } else {
        request.log.debug({ err: error, statusCode }, error.message)
      }

      return reply.status(statusCode).send(body)
    },
  )
}

export default fp(errorHandlerPlugin, { name: 'error-handler' })
