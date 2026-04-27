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

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Validation error',
          statusCode: 400,
          issues: error.issues,
        })
      }

      if (isPgUniqueError(error)) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Resource already exists',
          statusCode: 409,
        })
      }

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
          statusCode: error.statusCode,
        })
      }

      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Internal error',
        statusCode: 500,
      })
    },
  )
}

export default fp(errorHandlerPlugin, { name: 'error-handler' })
