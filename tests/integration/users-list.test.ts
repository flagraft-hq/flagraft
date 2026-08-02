import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { users } from '../../src/db/schema.js'
import { createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

type App = Awaited<ReturnType<typeof buildServer>>

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  projects: string[]
}

interface UsersPage {
  data: UserRow[]
  total: number
  limit: number
  offset: number
  counts: {
    all: number
    active: number
    invited: number
    suspended: number
    system: number
    owners: number
    admins: number
  }
}

describeIfDb('GET /api/v1/admin/users', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
    /**
     * truncateAll skips users, and boot seeding would add a default admin,
     * so clear the table and start the server with skipBootSeed to keep the
     * counts in these tests exact.
     */
    await db!.execute(sql`TRUNCATE users, user_projects RESTART IDENTITY CASCADE`)
  })

  let seq = 0

  /**
   * Creates a user through the invite flow, optionally accepting the invite so
   * the account ends up active rather than pending.
   */
  async function makeUser(
    app: App,
    rootKey: string,
    opts: { role?: 'admin' | 'editor' | 'viewer'; projectIds?: string[]; accept?: boolean } = {},
  ) {
    const email = `u${seq++}@co.com`
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/invite',
      headers: { authorization: rootKey, origin: 'https://flags.example' },
      payload: { emails: [email], role: opts.role ?? 'viewer', projectIds: opts.projectIds ?? [] },
    })
    expect(res.statusCode).toBe(201)
    const { id, inviteUrl } = res.json<{ id: string; inviteUrl: string }[]>()[0]

    if (opts.accept) {
      const accept = await app.inject({
        method: 'POST',
        url: `/api/v1/public/invite/${inviteUrl.split('/invite/')[1]}/accept`,
        payload: { password: 'a-good-password-1' },
      })
      expect(accept.statusCode).toBe(200)
    }
    return { id, email }
  }

  /** createProject hard-codes the display name, so set the one we assert on. */
  async function namedProject(app: App, rootKey: string, name: string) {
    const project = await createProject(app, rootKey, name)
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/projects/${project.id}`,
      headers: { authorization: rootKey },
      payload: { name },
    })
    return project
  }

  async function list(app: App, rootKey: string, query = '') {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users${query}`,
      headers: { authorization: rootKey },
    })
    expect(res.statusCode).toBe(200)
    return res.json<UsersPage>()
  }

  it('pages through results and reports the unpaged total', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    for (let i = 0; i < 5; i++) await makeUser(app, rootKey)

    const first = await list(app, rootKey, '?limit=2&offset=0')
    expect(first).toMatchObject({ total: 5, limit: 2, offset: 0 })
    expect(first.data).toHaveLength(2)

    const second = await list(app, rootKey, '?limit=2&offset=2')
    const third = await list(app, rootKey, '?limit=2&offset=4')
    expect(third.data).toHaveLength(1)

    /** Every row appears exactly once across the pages. */
    const seen = [...first.data, ...second.data, ...third.data].map((u) => u.id)
    expect(new Set(seen).size).toBe(5)

    expect((await list(app, rootKey, '?limit=2&offset=99')).data).toEqual([])
    await app.close()
  })

  it('returns a deterministic order across repeated requests', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const created = []
    for (let i = 0; i < 4; i++) created.push(await makeUser(app, rootKey))

    const before = (await list(app, rootKey)).data.map((u) => u.id)

    /** An UPDATE moves the row in the heap; without ORDER BY the order shifts. */
    await db!.update(users).set({ name: 'Renamed Later' }).where(eq(users.id, created[0].id))

    const after = (await list(app, rootKey, '?sort=name&dir=asc')).data.map((u) => u.id)
    const again = (await list(app, rootKey, '?sort=name&dir=asc')).data.map((u) => u.id)
    expect(after).toEqual(again)
    expect(before).toHaveLength(after.length)
    await app.close()
  })

  it('searches name, email and project name, treating % as a literal', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const project = await namedProject(app, rootKey, 'checkout-team')
    const member = await makeUser(app, rootKey, { projectIds: [project.id] })
    await makeUser(app, rootKey)
    await db!.update(users).set({ name: 'Rollout 50% Bot' }).where(eq(users.id, member.id))

    /** The project name matches even though the user's own fields do not. */
    const byProject = await list(app, rootKey, '?search=checkout')
    expect(byProject.total).toBe(1)
    expect(byProject.data[0].id).toBe(member.id)

    expect((await list(app, rootKey, `?search=${encodeURIComponent(member.email)}`)).total).toBe(1)
    expect((await list(app, rootKey, '?search=ROLLOUT')).total).toBe(1)

    /** A bare % must not act as a wildcard matching every row. */
    expect((await list(app, rootKey, '?search=%25')).total).toBe(1)
    await app.close()
  })

  it('filters by status, treating service accounts as their own bucket', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const active = await makeUser(app, rootKey, { accept: true })
    await makeUser(app, rootKey)
    const robot = await makeUser(app, rootKey, { accept: true })
    await db!.update(users).set({ isSystem: true }).where(eq(users.id, robot.id))

    const activeOnly = await list(app, rootKey, '?status=active')
    expect(activeOnly.data.map((u) => u.id)).toContain(active.id)
    /** The service account is active too, but must not show under "active". */
    expect(activeOnly.data.map((u) => u.id)).not.toContain(robot.id)

    expect((await list(app, rootKey, '?status=invited')).total).toBe(1)

    const system = await list(app, rootKey, '?status=system')
    expect(system.total).toBe(1)
    expect(system.data[0].id).toBe(robot.id)
    await app.close()
  })

  it('filters by role and by project membership', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const alpha = await namedProject(app, rootKey, 'alpha')
    const beta = await namedProject(app, rootKey, 'beta')
    const admin = await makeUser(app, rootKey, { role: 'admin', projectIds: [alpha.id] })
    await makeUser(app, rootKey, { role: 'viewer', projectIds: [beta.id] })

    const admins = await list(app, rootKey, '?role=admin')
    expect(admins.total).toBe(1)
    expect(admins.data[0].id).toBe(admin.id)

    const inAlpha = await list(app, rootKey, `?projectId=${alpha.id}`)
    expect(inAlpha.total).toBe(1)
    expect(inAlpha.data[0].id).toBe(admin.id)
    expect(inAlpha.data[0].projects).toEqual(['alpha'])

    /** Filters compose. */
    expect((await list(app, rootKey, `?projectId=${beta.id}&role=admin`)).total).toBe(0)
    await app.close()
  })

  it('sorts by role privilege and by project count, not alphabetically', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const alpha = await namedProject(app, rootKey, 'alpha')
    const beta = await namedProject(app, rootKey, 'beta')
    await makeUser(app, rootKey, { role: 'viewer' })
    await makeUser(app, rootKey, { role: 'admin', projectIds: [alpha.id, beta.id] })
    await makeUser(app, rootKey, { role: 'editor', projectIds: [alpha.id] })

    /** admin before editor before viewer, despite 'a' < 'e' < 'v' being a coincidence here. */
    const byRole = await list(app, rootKey, '?sort=role&dir=asc')
    expect(byRole.data.map((u) => u.role)).toEqual(['admin', 'editor', 'viewer'])
    const byRoleDesc = await list(app, rootKey, '?sort=role&dir=desc')
    expect(byRoleDesc.data.map((u) => u.role)).toEqual(['viewer', 'editor', 'admin'])

    const byProjects = await list(app, rootKey, '?sort=projects&dir=desc')
    expect(byProjects.data.map((u) => u.projects.length)).toEqual([2, 1, 0])
    await app.close()
  })

  it('reports workspace-wide counts that ignore the active filters', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    await makeUser(app, rootKey, { role: 'admin', accept: true })
    await makeUser(app, rootKey, { role: 'viewer' })
    const robot = await makeUser(app, rootKey, { accept: true })
    await db!.update(users).set({ isSystem: true }).where(eq(users.id, robot.id))

    const unfiltered = await list(app, rootKey)
    expect(unfiltered.counts).toMatchObject({
      all: 3,
      active: 1,
      invited: 1,
      system: 1,
      suspended: 0,
      admins: 1,
    })

    /** Narrowing the page must not change the counts. */
    const filtered = await list(app, rootKey, '?status=invited&limit=1')
    expect(filtered.total).toBe(1)
    expect(filtered.counts).toEqual(unfiltered.counts)
    await app.close()
  })

  it('rejects a page size above the maximum', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users?limit=5000',
      headers: { authorization: rootKey },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('never leaks credential material on a paginated page', async () => {
    const app = await buildServer({ db, skipBootSeed: true })
    const rootKey = await createRootKey(db!)
    await makeUser(app, rootKey)

    const page = await list(app, rootKey)
    expect(page.data.length).toBeGreaterThan(0)
    for (const row of page.data as unknown as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('passwordHash')
      expect(row).not.toHaveProperty('inviteTokenHash')
      expect(row).not.toHaveProperty('inviteExpiresAt')
      expect(row).not.toHaveProperty('sessionVersion')
    }
    await app.close()
  })
})
