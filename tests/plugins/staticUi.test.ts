import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import staticUiPlugin, { uiIsBundled } from '../../src/plugins/staticUi.js'

function bundledUiDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'flagraft-ui-'))
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Flagraft</title>')
  writeFileSync(path.join(dir, 'app.js'), 'export default 1')
  return dir
}

async function app(dir?: string) {
  const fastify = Fastify({ logger: false })
  await fastify.register(staticUiPlugin, dir ? { dir } : {})
  fastify.get('/api/v1/thing', async () => ({ ok: true }))
  return fastify
}

const asBrowser = { accept: 'text/html,application/xhtml+xml' }

describe('uiIsBundled', () => {
  it('is false when there is no build to serve', () => {
    expect(uiIsBundled(mkdtempSync(path.join(tmpdir(), 'flagraft-empty-')))).toBe(false)
  })

  it('is true once index.html is there', () => {
    expect(uiIsBundled(bundledUiDir())).toBe(true)
  })
})

describe('staticUiPlugin with no bundled UI', () => {
  it('stays out of the way, so dev and tests are untouched', async () => {
    const fastify = await app(mkdtempSync(path.join(tmpdir(), 'flagraft-empty-')))
    const response = await fastify.inject({ method: 'GET', url: '/', headers: asBrowser })
    expect(response.statusCode).toBe(404)
  })
})

describe('staticUiPlugin with a bundled UI', () => {
  it('serves index.html at the root', async () => {
    const fastify = await app(bundledUiDir())
    const response = await fastify.inject({ method: 'GET', url: '/', headers: asBrowser })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Flagraft')
  })

  it('serves built assets', async () => {
    const fastify = await app(bundledUiDir())
    expect((await fastify.inject({ method: 'GET', url: '/app.js' })).statusCode).toBe(200)
  })

  /** A refresh on /flags must not 404, or every deep link breaks. */
  it('falls back to index.html for the app own routes', async () => {
    const fastify = await app(bundledUiDir())
    const response = await fastify.inject({
      method: 'GET',
      url: '/flags/checkout/production',
      headers: asBrowser,
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Flagraft')
  })

  /** An unknown API path is a caller error, not a page. */
  it('keeps unknown API routes a JSON 404', async () => {
    const fastify = await app(bundledUiDir())
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v1/nope',
      headers: asBrowser,
    })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
  })

  it('does not hand HTML to a non-browser caller', async () => {
    const fastify = await app(bundledUiDir())
    const response = await fastify.inject({
      method: 'GET',
      url: '/whatever',
      headers: { accept: 'application/json' },
    })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'NotFound' })
  })

  it('leaves real API routes alone', async () => {
    const fastify = await app(bundledUiDir())
    expect((await fastify.inject({ method: 'GET', url: '/api/v1/thing' })).statusCode).toBe(200)
  })
})
