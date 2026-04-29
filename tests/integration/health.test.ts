import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('health routes', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  it('GET /health responds without an auth header', async () => {
    const app = await buildServer({ db })
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })

  it('GET /ready responds without an auth header', async () => {
    const app = await buildServer({ db })
    const response = await app.inject({ method: 'GET', url: '/ready' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })

  it('GET /ready returns 503 when DB is unavailable', async () => {
    const app = await buildServer({ db })

    await db!.$pool.end()

    const response = await app.inject({ method: 'GET', url: '/ready' })
    expect(response.statusCode).toBe(503)
  })
})
