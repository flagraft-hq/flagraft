import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import dbPlugin from '../../src/plugins/db.js'
import healthPlugin from '../../src/plugins/health.js'

describe('healthPlugin', () => {
  async function app() {
    const fastify = Fastify({ logger: false })
    await fastify.register(dbPlugin)
    await fastify.register(healthPlugin)
    return fastify
  }

  it('GET /health returns status ok and uptime without auth', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const body = response.json<{ status: string; uptime: number }>()
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')
  })

  it('GET /ready returns 200 when DB is reachable', async () => {
    const fastify = await app()
    const response = await fastify.inject({ method: 'GET', url: '/ready' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })
})
