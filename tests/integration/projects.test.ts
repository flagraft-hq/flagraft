import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../../src/server.js'
import { createAdminKey, createProject, createRootKey } from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('projects', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  /**
   * Tests for creating new projects
   */
  describe('POST /api/admin/projects', () => {
    it('creates a project successfully and returns 201 with correct shape', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
        payload: { name: 'My Project', slug: 'my-project' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toMatchObject({
        name: 'My Project',
        slug: 'my-project',
      })
      const body = response.json<{
        id: string
        name: string
        slug: string
        createdAt: string
        updatedAt: string
      }>()
      expect(typeof body.id).toBe('string')
      expect(typeof body.createdAt).toBe('string')
      expect(typeof body.updatedAt).toBe('string')
      await app.close()
    })

    it('auto-creates development, staging, and production environments', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'env-check')

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}/environments`,
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(200)
      const envs = response.json<Array<{ slug: string }>>()
      const slugs = envs.map((e) => e.slug).sort()
      expect(slugs).toEqual(['development', 'production', 'staging'])
      await app.close()
    })

    it('returns 409 on duplicate slug', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      await createProject(app, rootKey, 'clash')

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
        payload: { name: 'Another', slug: 'clash' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ error: 'Conflict', statusCode: 409 })
      await app.close()
    })

    it('returns 400 when name is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
        payload: { slug: 'no-name' },
      })

      expect(response.statusCode).toBe(400)
      await app.close()
    })

    it('returns 400 when slug is missing', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
        payload: { name: 'No Slug' },
      })

      expect(response.statusCode).toBe(400)
      await app.close()
    })

    it('returns 403 when called with a project-scoped admin key', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'existing')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/projects',
        headers: { authorization: adminKey },
        payload: { name: 'Sneaky', slug: 'sneaky' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })
  })

  /**
   * Tests for listing all projects
   */
  describe('GET /api/admin/projects', () => {
    it('root key sees all projects when multiple exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      await createProject(app, rootKey, 'alpha')
      await createProject(app, rootKey, 'beta')

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(200)
      const projects = response.json<Array<{ slug: string }>>()
      const slugs = projects.map((p) => p.slug).sort()
      expect(slugs).toContain('alpha')
      expect(slugs).toContain('beta')
      expect(projects.length).toBeGreaterThanOrEqual(2)
      await app.close()
    })

    it('project-scoped admin key sees only its own project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'mine')
      await createProject(app, rootKey, 'theirs')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(200)
      const projects = response.json<Array<{ slug: string }>>()
      expect(projects.length).toBe(1)
      expect(projects[0].slug).toBe('mine')
      await app.close()
    })

    it('returns empty array when no projects exist (root key)', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects',
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
      await app.close()
    })
  })

  /**
   * Tests for retrieving a single project by ID
   */
  describe('GET /api/admin/projects/:projectId', () => {
    it('returns the project by id', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'fetch-me')

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ id: project.id, slug: 'fetch-me' })
      await app.close()
    })

    it('returns 404 for a non-existent project id', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/projects/00000000-0000-0000-0000-000000000000',
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })

    it('returns 403 when a project admin tries to access a different project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const projectA = await createProject(app, rootKey, 'project-a')
      const projectB = await createProject(app, rootKey, 'project-b')
      const adminKeyA = await createAdminKey(app, rootKey, projectA.id)

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/projects/${projectB.id}`,
        headers: { authorization: adminKeyA },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })
  })

  /**
   * Tests for updating a project
   */
  describe('PATCH /api/admin/projects/:projectId', () => {
    it('updates name successfully and returns 200 with updated name', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'patch-name')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
        payload: { name: 'Updated Name' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ id: project.id, name: 'Updated Name' })
      await app.close()
    })

    it('updates slug successfully', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'old-slug')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
        payload: { slug: 'new-slug' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ id: project.id, slug: 'new-slug' })
      await app.close()
    })

    it('returns 404 for a non-existent project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/projects/00000000-0000-0000-0000-000000000000',
        headers: { authorization: rootKey },
        payload: { name: 'Ghost' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })

    it('returns 409 when patching to a slug already taken by another project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      await createProject(app, rootKey, 'taken')
      const project = await createProject(app, rootKey, 'to-patch')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
        payload: { slug: 'taken' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ error: 'Conflict', statusCode: 409 })
      await app.close()
    })

    it('returns 400 when body is empty', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'empty-patch')

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      await app.close()
    })
  })

  /**
   * Tests for deleting a project
   */
  describe('DELETE /api/admin/projects/:projectId', () => {
    it('deletes a project and returns 204', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'to-delete')

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(204)
      await app.close()
    })

    it('returns 404 when deleting a non-existent project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/projects/00000000-0000-0000-0000-000000000000',
        headers: { authorization: rootKey },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })

    it('returns 403 when called with a project-scoped admin key', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey, 'no-delete')
      const adminKey = await createAdminKey(app, rootKey, project.id)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/projects/${project.id}`,
        headers: { authorization: adminKey },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'Forbidden', statusCode: 403 })
      await app.close()
    })
  })
})
