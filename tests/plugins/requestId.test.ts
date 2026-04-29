import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import requestIdPlugin from '../../src/plugins/requestId.js'

describe('requestIdPlugin', () => {
  async function app() {
    const fastify = Fastify({ logger: false })
    await fastify.register(requestIdPlugin)
    fastify.get('/ping', () => ({ ok: true }))
    return fastify
  }

  it('adds X-Request-Id header to every response', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/ping' })
    expect(response.headers['x-request-id']).toBeDefined()
  })

  it('X-Request-Id is a non-empty string', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/ping' })
    expect(typeof response.headers['x-request-id']).toBe('string')
    expect((response.headers['x-request-id'] as string).length).toBeGreaterThan(0)
  })

  it('each request gets a unique X-Request-Id', async () => {
    const fastify = await app()
    const [r1, r2] = await Promise.all([
      fastify.inject({ method: 'GET', url: '/ping' }),
      fastify.inject({ method: 'GET', url: '/ping' }),
    ])
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id'])
  })
})
