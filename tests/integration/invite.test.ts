import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

/** Pulls the /invite/:token segment out of a returned invite URL. */
function tokenFromUrl(url: string): string {
  return url.split('/invite/')[1]
}

describeIfDb('invite flow', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
    /** truncateAll skips users; invited accounts must be cleared for a hermetic run. */
    await db!.execute(sql`TRUNCATE users, user_projects RESTART IDENTITY CASCADE`)
  })

  /** Unique email per invite so leftover user rows (users isn't truncated) never collide. */
  let seq = 0
  async function invite(app: Awaited<ReturnType<typeof buildServer>>, rootKey: string) {
    const email = `newbie${seq++}@co.com`
    const project = await createProject(app, rootKey)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: [email], role: 'editor', projectIds: [project.id] },
    })
    expect(res.statusCode).toBe(201)
    return res.json<{ email: string; inviteUrl: string; emailed: boolean }[]>()[0]
  }

  it('issues an invite link (not emailed, no SMTP) built from the request origin', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const result = await invite(app, rootKey)
    expect(result.emailed).toBe(false)
    expect(result.inviteUrl).toMatch(/^https:\/\/flags\.example\/invite\/.+/)
    await app.close()
  })

  it('validates a pending token, accepts it, then rejects reuse', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const { inviteUrl, email } = await invite(app, rootKey)
    const token = tokenFromUrl(inviteUrl)

    const check = await app.inject({ method: 'GET', url: `/api/v1/public/invite/${token}` })
    expect(check.statusCode).toBe(200)
    expect(check.json<{ email: string }>().email).toBe(email)

    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/public/invite/${token}/accept`,
      payload: { password: 'my-new-password' },
    })
    expect(accept.statusCode).toBe(200)
    expect(accept.cookies.some((c) => c.name === 'flagraft_session')).toBe(true)

    /** Token is single-use: a second validate must now fail. */
    const reuse = await app.inject({ method: 'GET', url: `/api/v1/public/invite/${token}` })
    expect(reuse.statusCode).toBe(410)

    await app.close()
  })

  it('lets the activated user log in with their chosen password', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const { inviteUrl, email } = await invite(app, rootKey)
    const token = tokenFromUrl(inviteUrl)

    await app.inject({
      method: 'POST',
      url: `/api/v1/public/invite/${token}/accept`,
      payload: { password: 'my-new-password' },
    })

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email, password: 'my-new-password' },
    })
    expect(login.statusCode).toBe(200)
    await app.close()
  })

  it('rejects an unknown token with 410', async () => {
    const app = await buildServer({ db })
    const res = await app.inject({ method: 'GET', url: '/api/v1/public/invite/nope' })
    expect(res.statusCode).toBe(410)
    await app.close()
  })

  it('rejects a too-short password with 400', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const { inviteUrl } = await invite(app, rootKey)
    const token = tokenFromUrl(inviteUrl)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/public/invite/${token}/accept`,
      payload: { password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
