import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

describe('rate limiting', () => {
  async function app(max: number) {
    const fastify = Fastify({ logger: false })
    await fastify.register(rateLimit, {
      max,
      timeWindow: 60_000,
      errorResponseBuilder: (_request, context) => ({
        error: 'TooManyRequests',
        message: `Rate limit exceeded, retry in ${context.after}`,
        statusCode: 429,
      }),
    })
    fastify.get('/client/features', () => ({ features: [] }))
    return fastify
  }

  it('allows requests within the limit', async () => {
    const fastify = await app(5)
    const response = await fastify.inject({ method: 'GET', url: '/client/features' })
    expect(response.statusCode).toBe(200)
  })

  it('returns 429 after exceeding the limit', async () => {
    const fastify = await app(2)
    await fastify.inject({ method: 'GET', url: '/client/features' })
    await fastify.inject({ method: 'GET', url: '/client/features' })
    const response = await fastify.inject({ method: 'GET', url: '/client/features' })
    expect(response.statusCode).toBe(429)
  })

  it('returns the standard error envelope on 429', async () => {
    const fastify = await app(1)
    await fastify.inject({ method: 'GET', url: '/client/features' })
    const response = await fastify.inject({ method: 'GET', url: '/client/features' })
    expect(response.statusCode).toBe(429)
    const body = response.json<{ error: string; message: string; statusCode: number }>()
    expect(body.error).toBe('TooManyRequests')
    expect(body.statusCode).toBe(429)
    expect(typeof body.message).toBe('string')
  })
})
