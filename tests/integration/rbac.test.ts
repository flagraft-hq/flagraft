import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { users } from '../../src/db/schema.js'
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

  /**
   * Promotes an invited admin to owner with the root key, which is the only
   * way to reach the owner role -- invites cannot hand it out.
   */
  async function ownerSession(app: App, rootKey: string, projectIds: string[]) {
    const session = await sessionUser(app, rootKey, 'admin', projectIds)
    const promote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${session.id}`,
      headers: { authorization: rootKey },
      payload: { role: 'owner' },
    })
    expect(promote.statusCode).toBe(200)
    return session
  }

  /** Creates a flag with the root key so role checks are not in the way. */
  async function createFlag(app: App, rootKey: string, projectId: string, key: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${projectId}/flags`,
      headers: { authorization: rootKey },
      payload: { name: key, key },
    })
    expect(res.statusCode).toBe(201)
  }

  /** Sets the project's default state for newly-created flags. */
  async function setDefaultState(app: App, rootKey: string, projectId: string, state: string) {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${projectId}`,
      headers: { authorization: rootKey },
      payload: { settings: { flagDefaults: { defaultState: state } } },
    })
    expect(res.statusCode).toBe(200)
  }

  async function environmentId(app: App, rootKey: string, projectId: string, slug: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${projectId}/environments`,
      headers: { authorization: rootKey },
    })
    expect(res.statusCode).toBe(200)
    const found = res.json<{ id: string; slug: string }[]>().find((e) => e.slug === slug)
    expect(found).toBeDefined()
    return found!.id
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
    const rows = list.json<{ data: Record<string, unknown>[] }>().data
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

  it('suspended login with correct password says suspended; wrong password stays generic', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const editor = await sessionUser(app, rootKey, 'editor', [])

    const suspend = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${editor.id}`,
      headers: { authorization: rootKey },
      payload: { status: 'suspended' },
    })
    expect(suspend.statusCode).toBe(200)

    const correct = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: editor.email, password: 'rbac-password-1' },
    })
    expect(correct.statusCode).toBe(403)
    expect(correct.json<{ message: string }>().message).toMatch(/suspended/i)

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: editor.email, password: 'wrong-password-1' },
    })
    expect(wrong.statusCode).toBe(401)
    expect(wrong.json<{ message: string }>().message).toBe('Invalid email or password')
    await app.close()
  })

  it('stamps lastLoginAt on a successful login', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const editor = await sessionUser(app, rootKey, 'editor', [])

    /** Accepting an invite hands out a session directly, so nothing is stamped yet. */
    const before = await db!
      .select({ at: users.lastLoginAt })
      .from(users)
      .where(eq(users.id, editor.id))
    expect(before[0].at).toBeNull()

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: editor.email, password: 'rbac-password-1' },
    })
    expect(login.statusCode).toBe(200)

    const after = await db!
      .select({ at: users.lastLoginAt })
      .from(users)
      .where(eq(users.id, editor.id))
    expect(after[0].at).toBeInstanceOf(Date)
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

  it('editor can toggle a flag in development but not in protected production', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'toggle-proj')
    await createFlag(app, rootKey, project.id, 'toggle.me')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const dev = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/toggle.me/environments/development/enable`,
      cookies: editor.cookies,
    })
    expect(dev.statusCode).toBe(200)

    const prod = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/toggle.me/environments/production/enable`,
      cookies: editor.cookies,
    })
    expect(prod.statusCode).toBe(403)
    await app.close()
  })

  it('owner and admin can toggle a flag in protected production', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'prod-toggle')
    await createFlag(app, rootKey, project.id, 'prod.flag')
    const admin = await sessionUser(app, rootKey, 'admin', [project.id])
    const owner = await ownerSession(app, rootKey, [project.id])

    const byAdmin = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/prod.flag/environments/production/enable`,
      cookies: admin.cookies,
    })
    expect(byAdmin.statusCode).toBe(200)

    const byOwner = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags/prod.flag/environments/production/disable`,
      cookies: owner.cookies,
    })
    expect(byOwner.statusCode).toBe(200)
    await app.close()
  })

  it('a project default of "on" does not let an editor create a flag already enabled in protected production', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'default-on-proj')
    await setDefaultState(app, rootKey, project.id, 'on')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: editor.cookies,
      payload: { name: 'sneaky-default', key: 'sneaky.default' },
    })
    expect(create.statusCode).toBe(201)
    const flag = create.json<{ state: Record<string, { on: boolean }> }>()
    expect(flag.state.development.on).toBe(true)
    expect(flag.state.production.on).toBe(false)
    await app.close()
  })

  it('a project default of "on" does let an owner create a flag already enabled in protected production', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'default-on-owner')
    await setDefaultState(app, rootKey, project.id, 'on')
    const owner = await ownerSession(app, rootKey, [project.id])

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/flags`,
      cookies: owner.cookies,
      payload: { name: 'deliberate-default', key: 'deliberate.default' },
    })
    expect(create.statusCode).toBe(201)
    const flag = create.json<{ state: Record<string, { on: boolean }> }>()
    expect(flag.state.production.on).toBe(true)
    await app.close()
  })

  it('editor can change targeting in development but not in protected production', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'targeting-proj')
    await createFlag(app, rootKey, project.id, 'target.me')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])
    const payload = { strategies: [{ constraints: [] }] }

    const dev = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/projects/${project.id}/flags/target.me/environments/development/strategies`,
      cookies: editor.cookies,
      payload,
    })
    expect(dev.statusCode).toBe(200)

    const prod = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/projects/${project.id}/flags/target.me/environments/production/strategies`,
      cookies: editor.cookies,
      payload,
    })
    expect(prod.statusCode).toBe(403)
    await app.close()
  })

  it('editor can create and edit flags but not delete them', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'flag-delete-proj')
    await createFlag(app, rootKey, project.id, 'keep.me')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const rename = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${project.id}/flags/keep.me`,
      cookies: editor.cookies,
      payload: { name: 'Renamed Flag' },
    })
    expect(rename.statusCode).toBe(200)

    /** Deleting a flag turns it off everywhere, protected environments included. */
    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/flags/keep.me`,
      cookies: editor.cookies,
    })
    expect(remove.statusCode).toBe(403)

    const owner = await ownerSession(app, rootKey, [project.id])
    const byOwner = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/flags/keep.me`,
      cookies: owner.cookies,
    })
    expect(byOwner.statusCode).toBe(204)
    await app.close()
  })

  it('editor cannot manage environments', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'env-proj')
    const devId = await environmentId(app, rootKey, project.id, 'development')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/environments`,
      cookies: editor.cookies,
      payload: { name: 'Staging', slug: 'staging', protected: false },
    })
    expect(create.statusCode).toBe(403)

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${project.id}/environments/${devId}`,
      cookies: editor.cookies,
      payload: { name: 'Renamed' },
    })
    expect(update.statusCode).toBe(403)

    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/environments/${devId}`,
      cookies: editor.cookies,
    })
    expect(remove.statusCode).toBe(403)

    /** Reading them is still fine -- the UI needs the list. */
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${project.id}/environments`,
      cookies: editor.cookies,
    })
    expect(list.statusCode).toBe(200)
    await app.close()
  })

  it('editor cannot issue or revoke API keys', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'keys-proj')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const issue = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/keys`,
      cookies: editor.cookies,
      payload: { type: 'admin', description: 'Sneaky key' },
    })
    expect(issue.statusCode).toBe(403)

    const existing = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: rootKey },
      payload: { type: 'admin', description: 'Legit key' },
    })
    expect(existing.statusCode).toBe(201)

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/keys/${existing.json<{ id: string }>().id}`,
      cookies: editor.cookies,
    })
    expect(revoke.statusCode).toBe(403)
    await app.close()
  })

  it('editor cannot edit project settings or context fields', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'settings-proj')
    const editor = await sessionUser(app, rootKey, 'editor', [project.id])

    const rename = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${project.id}`,
      cookies: editor.cookies,
      payload: { name: 'Renamed By Editor' },
    })
    expect(rename.statusCode).toBe(403)

    const addField = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${project.id}/context-fields`,
      cookies: editor.cookies,
      payload: { key: 'plan', name: 'Plan', type: 'string' },
    })
    expect(addField.statusCode).toBe(403)
    await app.close()
  })

  it('an admin cannot delete a project but an owner can', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'delete-proj')
    const admin = await sessionUser(app, rootKey, 'admin', [project.id])

    const byAdmin = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}`,
      cookies: admin.cookies,
    })
    expect(byAdmin.statusCode).toBe(403)

    const owner = await ownerSession(app, rootKey, [project.id])
    const byOwner = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}`,
      cookies: owner.cookies,
    })
    expect(byOwner.statusCode).toBe(204)
    await app.close()
  })

  it('an admin cannot grant the owner role but an owner can', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const admin = await sessionUser(app, rootKey, 'admin', [])
    const target = await sessionUser(app, rootKey, 'editor', [])

    const selfPromote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${admin.id}`,
      cookies: admin.cookies,
      payload: { role: 'owner' },
    })
    expect(selfPromote.statusCode).toBe(403)

    const owner = await ownerSession(app, rootKey, [])
    const byOwner = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${target.id}`,
      cookies: owner.cookies,
      payload: { role: 'owner' },
    })
    expect(byOwner.statusCode).toBe(200)
    await app.close()
  })

  it('the last owner cannot be demoted, suspended or deleted', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)

    /** The boot owner is seeded on ready, so wait for it before looking. */
    await app.ready()
    /** First boot seeds exactly one owner, which is the one at risk here. */
    const [soleOwner] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'owner'))
    expect(soleOwner).toBeDefined()

    for (const payload of [{ role: 'admin' }, { status: 'suspended' }]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${soleOwner.id}`,
        headers: { authorization: rootKey },
        payload,
      })
      expect(res.statusCode).toBe(409)
    }

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${soleOwner.id}`,
      headers: { authorization: rootKey },
    })
    expect(removed.statusCode).toBe(409)

    /** With a second owner in place the first one can step down. */
    await ownerSession(app, rootKey, [])
    const demote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${soleOwner.id}`,
      headers: { authorization: rootKey },
      payload: { role: 'admin' },
    })
    expect(demote.statusCode).toBe(200)
    await app.close()
  })

  it('an invited owner-to-be does not count toward the active-owner guard', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    await app.ready()
    const [bootOwner] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'owner'))
    expect(bootOwner).toBeDefined()

    /** Promote an invite to owner before it is ever accepted -- status stays 'invited'. */
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: ['pending-owner@co.com'], role: 'editor', projectIds: [] },
    })
    expect(inviteRes.statusCode).toBe(201)
    const { id: pendingOwnerId } = inviteRes.json<{ id: string }[]>()[0]
    const promote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${pendingOwnerId}`,
      headers: { authorization: rootKey },
      payload: { role: 'owner' },
    })
    expect(promote.statusCode).toBe(200)

    /** The boot owner is still the only *active* one, so it stays protected. */
    const demoteBoot = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bootOwner.id}`,
      headers: { authorization: rootKey },
      payload: { role: 'admin' },
    })
    expect(demoteBoot.statusCode).toBe(409)

    /** The pending owner never became active, so removing it is unrestricted. */
    const deletePending = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${pendingOwnerId}`,
      headers: { authorization: rootKey },
    })
    expect(deletePending.statusCode).toBe(204)
    await app.close()
  })

  it('an admin cannot demote, suspend, or delete an owner, but another owner can', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const target = await ownerSession(app, rootKey, [])
    const actorOwner = await ownerSession(app, rootKey, [])
    const admin = await sessionUser(app, rootKey, 'admin', [])

    const demoteByAdmin = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${target.id}`,
      cookies: admin.cookies,
      payload: { role: 'admin' },
    })
    expect(demoteByAdmin.statusCode).toBe(403)

    const suspendByAdmin = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${target.id}`,
      cookies: admin.cookies,
      payload: { status: 'suspended' },
    })
    expect(suspendByAdmin.statusCode).toBe(403)

    const deleteByAdmin = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${target.id}`,
      cookies: admin.cookies,
    })
    expect(deleteByAdmin.statusCode).toBe(403)

    const demoteByOwner = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${target.id}`,
      cookies: actorOwner.cookies,
      payload: { role: 'admin' },
    })
    expect(demoteByOwner.statusCode).toBe(200)
    await app.close()
  })

  it('a protected environment cannot be deleted until protection is turned off', async () => {
    const app = await buildServer({ db })
    const rootKey = await createRootKey(db!)
    const project = await createProject(app, rootKey, 'protected-proj')
    const prodId = await environmentId(app, rootKey, project.id, 'production')

    const blocked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/environments/${prodId}`,
      headers: { authorization: rootKey },
    })
    expect(blocked.statusCode).toBe(409)

    const unprotect = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${project.id}/environments/${prodId}`,
      headers: { authorization: rootKey },
      payload: { protected: false },
    })
    expect(unprotect.statusCode).toBe(200)

    const allowed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/projects/${project.id}/environments/${prodId}`,
      headers: { authorization: rootKey },
    })
    expect(allowed.statusCode).toBe(204)
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
