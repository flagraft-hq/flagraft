import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import swaggerPlugin from '../../src/plugins/swagger.js'

describe('swagger plugin', () => {
  async function app() {
    const fastify = Fastify({ logger: false })
    await fastify.register(swaggerPlugin)
    return fastify
  }

  it('serves OpenAPI JSON at /docs/json', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/docs/json' })
    expect(response.statusCode).toBe(200)
    const body = response.json<{ openapi: string }>()
    expect(body.openapi).toMatch(/^3\./)
  })

  it('serves Swagger UI at /docs', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/docs' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/text\/html/)
  })

  it('does not register docs routes in production', async () => {
    const original = process.env.NODE_ENV
    const originalPw = process.env.DEFAULT_ADMIN_PASSWORD
    process.env.NODE_ENV = 'production'
    /** Production boot refuses the documented default admin password. */
    process.env.DEFAULT_ADMIN_PASSWORD = 'a-strong-test-only-password'
    try {
      const { buildServer } = await import('../../src/server.js')
      const fastify = await buildServer()
      const json = await fastify.inject({ method: 'GET', url: '/docs/json' })
      const ui = await fastify.inject({ method: 'GET', url: '/docs' })
      expect(json.statusCode).toBe(404)
      expect(ui.statusCode).toBe(404)
    } finally {
      process.env.NODE_ENV = original
      if (originalPw === undefined) delete process.env.DEFAULT_ADMIN_PASSWORD
      else process.env.DEFAULT_ADMIN_PASSWORD = originalPw
    }
  })
})
