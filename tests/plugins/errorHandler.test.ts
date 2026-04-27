import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import errorHandlerPlugin, { AppError } from '../../src/plugins/errorHandler.js'

describe('errorHandlerPlugin', () => {
  async function app() {
    const fastify = Fastify({ logger: false })
    await fastify.register(errorHandlerPlugin)
    return fastify
  }

  it('normalizes Zod errors', async () => {
    const fastify = await app()
    fastify.get('/zod', async () => z.object({ name: z.string() }).parse({}))
    const response = await fastify.inject('/zod')
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'ValidationError', statusCode: 400 })
  })

  it('normalizes unique conflicts', async () => {
    const fastify = await app()
    fastify.get('/conflict', async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { code: '23505' }
    })
    const response = await fastify.inject('/conflict')
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ error: 'Conflict', statusCode: 409 })
  })

  it('passes AppError code and status through', async () => {
    const fastify = await app()
    fastify.get('/app', async () => {
      throw new AppError('not found', 404, 'NotFound')
    })
    const response = await fastify.inject('/app')
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'NotFound', message: 'not found' })
  })

  it('does not leak unknown internals', async () => {
    const fastify = await app()
    fastify.get('/boom', async () => {
      throw new Error('boom')
    })
    const response = await fastify.inject('/boom')
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Internal error',
      statusCode: 500,
    })
    expect(response.body).not.toContain('boom')
  })
})
