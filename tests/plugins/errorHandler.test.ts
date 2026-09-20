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

  it('answers an oversized body with 413, not a misleading 500', async () => {
    const fastify = Fastify({ logger: false, bodyLimit: 32 })
    await fastify.register(errorHandlerPlugin)
    fastify.post('/import', async () => ({ ok: true }))

    const response = await fastify.inject({
      method: 'POST',
      url: '/import',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ document: 'x'.repeat(200) }),
    })

    expect(response.statusCode).toBe(413)
    expect(response.json()).toMatchObject({ error: 'PayloadTooLarge', statusCode: 413 })
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

  /**
   * The 500 body deliberately says nothing, so the log line is the only place
   * the real cause survives.
   */
  it('logs the cause of a 500 that the response hides', async () => {
    const lines: Array<{ level: number; msg: string; err?: { message: string; stack: string } }> =
      []
    const fastify = Fastify({
      logger: {
        level: 'debug',
        stream: {
          write(chunk: string) {
            lines.push(JSON.parse(chunk) as (typeof lines)[number])
          },
        },
      },
      disableRequestLogging: true,
    })
    await fastify.register(errorHandlerPlugin)
    fastify.get('/boom', async () => {
      throw new Error('the real cause')
    })

    await fastify.inject('/boom')

    const logged = lines.find((l) => l.msg === 'the real cause')
    expect(logged).toBeDefined()
    /** pino's error level. */
    expect(logged!.level).toBe(50)
    expect(logged!.err?.stack).toContain('the real cause')
  })

  it('keeps a caller mistake at debug level', async () => {
    const lines: Array<{ level: number; msg: string }> = []
    const fastify = Fastify({
      logger: {
        level: 'debug',
        stream: {
          write(chunk: string) {
            lines.push(JSON.parse(chunk) as (typeof lines)[number])
          },
        },
      },
      disableRequestLogging: true,
    })
    await fastify.register(errorHandlerPlugin)
    fastify.get('/nope', async () => {
      throw new AppError('not found', 404, 'NotFound')
    })

    await fastify.inject('/nope')

    const logged = lines.find((l) => l.msg === 'not found')
    expect(logged).toBeDefined()
    /** pino's debug level -- not error, so a 404 never pages anyone. */
    expect(logged!.level).toBe(20)
  })
})
