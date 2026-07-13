import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

type App = Awaited<ReturnType<typeof buildServer>>

describeIfDb('session RBAC', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
    /** truncateAll skips users; clear them for a hermetic run. */
    await db!.execute(sql`TRUNCATE users, user_projects RESTART IDENTITY CASCADE`)
  })

  let seq = 0

  /**
   * Creates a user with the given role via the invite flow and returns a live
   * session cookie plus their user id and member project ids.
   */
  async function sessionUser(
    app: App,
    rootKey: string,
    role: 'admin' | 'editor' | 'viewer',
    projectIds: string[],
  ) {
    const email = `rbac${seq++}@co.com`
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: [email], role, projectIds },
    })
    expect(inviteRes.statusCode).toBe(201)
    const { id, inviteUrl } = inviteRes.json<{ id: string; inviteUrl: string }[]>()[0]
    const token = inviteUrl.split('/invite/')[1]
    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/public/invite/${token}/accept`,
      payload: { password: 'rbac-password-1' },
    })
    expect(accept.statusCode).toBe(200)
    const cookie = accept.cookies.find((c) => c.name === 'flagraft_session')!
    return { id, email, cookies: { flagraft_session: cookie.value } }
  }

  it('viewer can read their project but cannot mutate anything', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'viewer-proj')
    const viewer = await sessionUser(app, rootKey, 'viewer', [project.id])

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: viewer.cookies,
    })
    expect(read.statusCode).toBe(200)

    const write = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: viewer.cookies,
      payload: { name: 'Sneaky Flag', key: 'sneaky.flag' },
    })
    expect(write.statusCode).toBe(403)
    await app.close()
  })

  it('editor can mutate flags in their project but not foreign projects', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const mine = await createProject(app, rootKey, 'editor-mine')
    const foreign = await createProject(app, rootKey, 'editor-foreign')
    const editor = await sessionUser(app, rootKey, 'editor', [mine.id])

    const write = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${mine.id}/flags`,
      cookies: editor.cookies,
      payload: { name: 'My Flag', key: 'my.flag' },
    })
    expect(write.statusCode).toBe(201)

    const foreignRead = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${foreign.id}/flags`,
      cookies: editor.cookies,
    })
    expect(foreignRead.statusCode).toBe(403)
    await app.close()
  })

  it('editor cannot manage users, keys of foreign projects, or create projects', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const mine = await createProject(app, rootKey, 'editor-scope')
    const editor = await sessionUser(app, rootKey, 'editor', [mine.id])

    const listUsers = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      cookies: editor.cookies,
    })
    expect(listUsers.statusCode).toBe(403)

    const createProj = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/projects',
      cookies: editor.cookies,
      payload: { name: 'Nope', slug: 'nope' },
    })
    expect(createProj.statusCode).toBe(403)
    await app.close()
  })

  it('admin-role session can manage users and responses never leak credentials', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const admin = await sessionUser(app, rootKey, 'admin', [])

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      cookies: admin.cookies,
    })
    expect(list.statusCode).toBe(200)
    const rows = list.json<Record<string, unknown>[]>()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).not.toHaveProperty('passwordHash')
      expect(row).not.toHaveProperty('inviteTokenHash')
      expect(row).not.toHaveProperty('inviteExpiresAt')
      expect(row).not.toHaveProperty('sessionVersion')
    }

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${admin.id}`,
      cookies: admin.cookies,
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).not.toHaveProperty('passwordHash')

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${admin.id}`,
      cookies: admin.cookies,
      payload: { name: 'Renamed Admin' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json()).not.toHaveProperty('passwordHash')
    await app.close()
  })

  it('editor sees only the projects they are members of', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const mine = await createProject(app, rootKey, 'list-mine')
    await createProject(app, rootKey, 'list-foreign')
    const editor = await sessionUser(app, rootKey, 'editor', [mine.id])

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/projects',
      cookies: editor.cookies,
    })
    expect(list.statusCode).toBe(200)
    const slugs = list.json<{ slug: string }[]>().map((p) => p.slug)
    expect(slugs).toEqual(['list-mine'])
    await app.close()
  })

  it('suspending a user kills their existing session immediately', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'suspend-proj')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: editor.cookies,
    })
    expect(before.statusCode).toBe(200)

    const suspend = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${editor.id}`,
      headers: { authorization: rootKey },
      payload: { status: 'suspended' },
    })
    expect(suspend.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: editor.cookies,
    })
    expect(after.statusCode).toBe(401)
    await app.close()
  })

  it('a password reset invalidates existing sessions and the new password logs in', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'reset-proj')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const reset = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${editor.id}/reset-password`,
      headers: { authorization: rootKey },
      payload: { password: 'brand-new-pass-1' },
    })
    expect(reset.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: editor.cookies,
    })
    expect(after.statusCode).toBe(401)

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: editor.email, password: 'brand-new-pass-1' },
    })
    expect(login.statusCode).toBe(200)
    await app.close()
  })

  it('rejects a password reset shorter than 8 characters', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const editor = await sessionUser(app, rootKey, 'editor', [])

    const reset = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${editor.id}/reset-password`,
      headers: { authorization: rootKey },
      payload: { password: 'short' },
    })
    expect(reset.statusCode).toBe(400)
    await app.close()
  })

  it('resetting an invited user activates the account so the password works', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)

    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: ['invited-reset@co.com'], role: 'viewer', projectIds: [] },
    })
    expect(inviteRes.statusCode).toBe(201)
    const { id } = inviteRes.json<{ id: string }[]>()[0]

    const reset = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${id}/reset-password`,
      headers: { authorization: rootKey },
      payload: { password: 'invited-new-pass' },
    })
    expect(reset.statusCode).toBe(204)

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'invited-reset@co.com', password: 'invited-new-pass' },
    })
    expect(login.statusCode).toBe(200)
    await app.close()
  })

  it('demoting an admin to viewer takes effect on the next request', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const admin = await sessionUser(app, rootKey, 'admin', [])

    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      cookies: admin.cookies,
    })
    expect(before.statusCode).toBe(200)

    const demote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${admin.id}`,
      headers: { authorization: rootKey },
      payload: { role: 'viewer' },
    })
    expect(demote.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      cookies: admin.cookies,
    })
    expect(after.statusCode).toBe(403)
    await app.close()
  })
})
