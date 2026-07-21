import { beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import {
  createAdminKey,
  createClientKey,
  createProject,
  createRootKey,
} from '../helpers/fixtures.js'
import { getTestDb, truncateAll } from '../helpers/db.js'

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

async function getEnvironments(
  app: Awaited<ReturnType<typeof buildServer>>,
  key: string,
  projectId: string,
) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/projects/${projectId}/environments`,
    headers: { authorization: key },
  })
  return res.json<Array<{ id: string; slug: string }>>()
}

async function createFlag(
  app: Awaited<ReturnType<typeof buildServer>>,
  key: string,
  projectId: string,
  flagKey: string,
) {
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/projects/${projectId}/flags`,
    headers: { authorization: key },
    payload: { name: flagKey, key: flagKey },
  })
}

async function enableFlag(
  app: Awaited<ReturnType<typeof buildServer>>,
  key: string,
  projectId: string,
  flagKey: string,
  envSlug: string,
) {
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${envSlug}/enable`,
    headers: { authorization: key },
  })
}

describeIfDb('client eval', () => {
  const db = process.env.TEST_DATABASE_URL ? getTestDb() : undefined

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    await truncateAll(db!)
  })

  describe('GET /api/v1/client/features', () => {
    it('returns empty features array when no flags exist', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const devEnv = envs.find((e) => e.slug === 'development')!
      const clientKey = await createClientKey(app, adminKey, project.id, devEnv.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ features: [] })
      await app.close()
    })

    it('returns all flags with their enabled status for the client environment', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const devEnv = envs.find((e) => e.slug === 'development')!
      const clientKey = await createClientKey(app, adminKey, project.id, devEnv.id)

      await createFlag(app, adminKey, project.id, 'alpha')
      await createFlag(app, adminKey, project.id, 'beta')
      await enableFlag(app, adminKey, project.id, 'alpha', 'development')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      const { features } = res.json<{ features: Array<{ name: string; enabled: boolean }> }>()
      expect(features).toHaveLength(2)
      const alpha = features.find((f) => f.name === 'alpha')
      const beta = features.find((f) => f.name === 'beta')
      expect(alpha).toMatchObject({ name: 'alpha', enabled: true })
      expect(beta).toMatchObject({ name: 'beta', enabled: false })
      await app.close()
    })

    it('shows a flag as disabled by default before it is explicitly enabled', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'new-flag')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      const { features } = res.json<{ features: Array<{ name: string; enabled: boolean }> }>()
      expect(features).toHaveLength(1)
      expect(features[0]).toMatchObject({ name: 'new-flag', enabled: false })
      await app.close()
    })

    it('shows a flag as enabled after it is enabled in the client environment', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'launched')
      await enableFlag(app, adminKey, project.id, 'launched', 'production')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      const { features } = res.json<{ features: Array<{ name: string; enabled: boolean }> }>()
      expect(features).toHaveLength(1)
      expect(features[0]).toMatchObject({ name: 'launched', enabled: true })
      await app.close()
    })

    it('env A client sees disabled flag while env B client sees enabled flag', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const devEnv = envs.find((e) => e.slug === 'development')!
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const devClient = await createClientKey(app, adminKey, project.id, devEnv.id)
      const productionClient = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'staged-only')
      await enableFlag(app, adminKey, project.id, 'staged-only', 'production')

      const devRes = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: devClient },
      })
      const productionRes = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: productionClient },
      })

      const devFeatures = devRes.json<{ features: Array<{ name: string; enabled: boolean }> }>()
        .features
      const productionFeatures = productionRes.json<{
        features: Array<{ name: string; enabled: boolean }>
      }>().features

      expect(devFeatures.find((f) => f.name === 'staged-only')).toMatchObject({ enabled: false })
      expect(productionFeatures.find((f) => f.name === 'staged-only')).toMatchObject({
        enabled: true,
      })
      await app.close()
    })

    it('ignores query params and returns the environment default', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'ctx-flag')

      const withQueryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features?userId=user_abc',
        headers: { authorization: clientKey },
      })
      const withoutQueryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      const withQueryFeatures = withQueryRes.json<{
        features: Array<{ name: string; enabled: boolean }>
      }>().features
      const withoutQueryFeatures = withoutQueryRes.json<{
        features: Array<{ name: string; enabled: boolean }>
      }>().features

      expect(withQueryFeatures.find((f) => f.name === 'ctx-flag')).toMatchObject({
        enabled: false,
      })
      expect(withoutQueryFeatures.find((f) => f.name === 'ctx-flag')).toMatchObject({
        enabled: false,
      })
      await app.close()
    })

    it('returns multiple flags together with correct statuses', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const prodEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, prodEnv.id)

      await createFlag(app, adminKey, project.id, 'flag-one')
      await createFlag(app, adminKey, project.id, 'flag-two')
      await createFlag(app, adminKey, project.id, 'flag-three')
      await enableFlag(app, adminKey, project.id, 'flag-one', 'production')
      await enableFlag(app, adminKey, project.id, 'flag-three', 'production')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      const { features } = res.json<{ features: Array<{ name: string; enabled: boolean }> }>()
      expect(features).toHaveLength(3)
      expect(features.find((f) => f.name === 'flag-one')).toMatchObject({ enabled: true })
      expect(features.find((f) => f.name === 'flag-two')).toMatchObject({ enabled: false })
      expect(features.find((f) => f.name === 'flag-three')).toMatchObject({ enabled: true })
      // reason is not included in the bulk endpoint
      features.forEach((f) => expect(f).not.toHaveProperty('reason'))
      await app.close()
    })
  })

  describe('GET /api/v1/client/features/:flagKey', () => {
    it('returns enabled false with reason disabled for a disabled flag', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const devEnv = envs.find((e) => e.slug === 'development')!
      const clientKey = await createClientKey(app, adminKey, project.id, devEnv.id)

      await createFlag(app, adminKey, project.id, 'off-flag')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features/off-flag',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ name: 'off-flag', enabled: false, reason: 'disabled' })
      await app.close()
    })

    it('returns enabled true with reason default for an enabled flag', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'on-flag')
      await enableFlag(app, adminKey, project.id, 'on-flag', 'production')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features/on-flag',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ name: 'on-flag', enabled: true, reason: 'default' })
      await app.close()
    })

    it('ignores query params and returns the environment default with reason default', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const productionEnv = envs.find((e) => e.slug === 'production')!
      const clientKey = await createClientKey(app, adminKey, project.id, productionEnv.id)

      await createFlag(app, adminKey, project.id, 'global-on')
      await enableFlag(app, adminKey, project.id, 'global-on', 'production')

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features/global-on?userId=blocked_user',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ name: 'global-on', enabled: true, reason: 'default' })
      await app.close()
    })

    it('returns 404 for a flag key that does not exist in the project', async () => {
      const app = await buildServer({ db })
      const rootKey = await createRootKey(db!)
      const project = await createProject(app, rootKey)
      const adminKey = await createAdminKey(app, rootKey, project.id)
      const envs = await getEnvironments(app, adminKey, project.id)
      const devEnv = envs.find((e) => e.slug === 'development')!
      const clientKey = await createClientKey(app, adminKey, project.id, devEnv.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/client/features/nonexistent-flag',
        headers: { authorization: clientKey },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ error: 'NotFound', statusCode: 404 })
      await app.close()
    })
  })
})
