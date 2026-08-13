import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import requestLogPlugin from '../../src/plugins/requestLog.js'

interface Line {
  level: number
  msg: string
  statusCode?: number
  responseTime?: number
}

describe('requestLogPlugin', () => {
  async function app() {
    const lines: Line[] = []
    const fastify = Fastify({
      logger: {
        level: 'debug',
        stream: {
          write(chunk: string) {
            lines.push(JSON.parse(chunk) as Line)
          },
        },
      },
      /** Matches how the server is built: the built-in per-request log is off. */
      disableRequestLogging: true,
    })
    await fastify.register(requestLogPlugin)
    fastify.get('/ok', () => ({ ok: true }))
    fastify.get('/missing', (_request, reply) => reply.status(404).send({ error: 'nope' }))
    fastify.get('/broken', (_request, reply) => reply.status(500).send({ error: 'boom' }))
    fastify.get('/slow', async (_request, reply) => {
      await new Promise((resolve) => setTimeout(resolve, 550))
      return reply.send({ ok: true })
    })
    return { fastify, lines }
  }

  it('says nothing about a fast successful request', async () => {
    const { fastify, lines } = await app()
    await fastify.inject('/ok')
    expect(lines).toEqual([])
  })

  /**
   * The admin UI probes /auth/me on every page load and gets a 401 until the
   * user signs in. That is the endpoint working, not failing.
   */
  it('says nothing about a 4xx, which is the caller being told no', async () => {
    const { fastify, lines } = await app()
    await fastify.inject('/missing')
    expect(lines).toEqual([])
  })

  it('logs a 5xx with its status', async () => {
    const { fastify, lines } = await app()
    await fastify.inject('/broken')
    expect(lines).toHaveLength(1)
    expect(lines[0].msg).toBe('request failed')
    expect(lines[0].statusCode).toBe(500)
  })

  it('logs a slow request even though it succeeded', async () => {
    const { fastify, lines } = await app()
    await fastify.inject('/slow')
    expect(lines).toHaveLength(1)
    expect(lines[0].msg).toBe('slow request')
    expect(lines[0].responseTime).toBeGreaterThanOrEqual(500)
  })
})
