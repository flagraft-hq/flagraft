import { beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('environments', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  describe('POST /api/admin/projects/:projectId/environments', () => {
    it('creates an environment successfully and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'QA', slug: 'qa' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({
        projectId: project.id,
        name: 'QA',
        slug: 'qa',
      })
      const body = res.json<{
        id: string
        projectId: string
        name: string
        slug: string
        createdAt: string
      }>()
      expect(typeof body.id).toBe('string')
      expect(typeof body.createdAt).toBe('string')
      await app.close()
    })

    it('returns 409 on duplicate slug within the same project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'Canary', slug: 'canary' },
      })

      const duplicate = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'Canary Again', slug: 'canary' },
      })

      expect(duplicate.statusCode).toBe(409)
      expect(duplicate.json()).toMatchObject({
        error: 'Conflict',
        statusCode: 409,
      })
      await app.close()
    })

    it('allows the same slug in two different projects', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-alpha')
      const projectB = await createProject(app, rootKey, 'project-beta')
      const adminKeyA = await createAdminKey(app, rootKey, projectA.id)
      const adminKeyB = await createAdminKey(app, rootKey, projectB.id)

      const resA = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${projectA.id}/environments`,
        headers: { authorization: adminKeyA },
        payload: { name: 'Canary', slug: 'canary' },
      })

      const resB = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${projectB.id}/environments`,
        headers: { authorization: adminKeyB },
        payload: { name: 'Canary', slug: 'canary' },
      })

      expect(resA.statusCode).toBe(201)
      expect(resB.statusCode).toBe(201)
      await app.close()
    })

    it('returns 400 when name is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { slug: 'no-name' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })

    it('returns 400 when slug is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'No Slug' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({
        error: 'ValidationError',
        statusCode: 400,
      })
      await app.close()
    })
  })

  describe('GET /api/admin/projects/:projectId/environments', () => {
    it('returns the 2 auto-created environments after project creation', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      const envs = res.json<Array<{ id: string; slug: string }>>()
      expect(envs).toHaveLength(2)
      expect(envs.map((e) => e.slug).sort()).toEqual(['development', 'production'])
      await app.close()
    })

    it('includes a newly created environment in addition to the 2 defaults', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'QA', slug: 'qa' },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      const envs = res.json<Array<{ id: string; slug: string }>>()
      expect(envs).toHaveLength(3)
      expect(envs.map((e) => e.slug)).toContain('qa')
      await app.close()
    })

    it('returns environments ordered by createdAt with auto-created envs first', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      await app.inject({
        method: 'POST',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
        payload: { name: 'QA', slug: 'qa' },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(200)
      const envs = res.json<Array<{ id: string; slug: string; createdAt: string }>>()
      expect(envs).toHaveLength(3)

      const defaultSlugs = ['development', 'production']
      const defaultEnvs = envs.filter((e) => defaultSlugs.includes(e.slug))
      const customEnvs = envs.filter((e) => !defaultSlugs.includes(e.slug))

      /**
       * All default envs should appear before the custom one (ordered by createdAt)
       */
      const lastDefaultIndex = Math.max(...defaultEnvs.map((e) => envs.indexOf(e)))
      const firstCustomIndex = Math.min(...customEnvs.map((e) => envs.indexOf(e)))
      expect(lastDefaultIndex).toBeLessThan(firstCustomIndex)

      /**
       * Verify the list is sorted ascending by createdAt
       */
      const timestamps = envs.map((e) => new Date(e.createdAt).getTime())
      const sorted = [...timestamps].sort((a, b) => a - b)
      expect(timestamps).toEqual(sorted)
      await app.close()
    })
  })

  describe('DELETE /api/admin/projects/:projectId/environments/:environmentId', () => {
    it('deletes an environment and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const envsRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
      })
      const envs = envsRes.json<Array<{ id: string; slug: string }>>()
      const target = envs.find((e) => e.slug === 'development')!

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}/environments/${target.id}`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(204)

      const afterRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: adminKey },
      })
      const remaining = afterRes.json<Array<{ id: string; slug: string }>>()
      expect(remaining.map((e) => e.slug)).not.toContain('development')
      await app.close()
    })

    it('returns 404 for a non-existent environmentId', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}/environments/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: adminKey },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })

    it('returns 404 when deleting an environment from project A using project B admin key', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-a')
      const projectB = await createProject(app, rootKey, 'project-b')
      const adminKeyA = await createAdminKey(app, rootKey, projectA.id)
      const adminKeyB = await createAdminKey(app, rootKey, projectB.id)

      const envsRes = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${projectA.id}/environments`,
        headers: { authorization: adminKeyA },
      })
      const envs = envsRes.json<Array<{ id: string; slug: string }>>()
      const targetEnv = envs[0]

      /**
       * Attempt to delete project A's environment using project B's admin key and project B's URL
       */
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${projectB.id}/environments/${targetEnv.id}`,
        headers: { authorization: adminKeyB },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({
        error: 'NotFound',
        statusCode: 404,
      })
      await app.close()
    })
  })
})
