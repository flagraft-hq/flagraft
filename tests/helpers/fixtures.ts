import type { FastifyInstance } from 'fastify'

import type { Db } from '../../src/db/index.js'
import { apiKeys } from '../../src/db/schema.js'
import { generateKey } from '../../src/plugins/auth.js'

export async function createRootKey(db: Db) {
  const generated = generateKey()
  await db.insert(apiKeys).values({
    keyHash: generated.hash,
    keyPrefix: generated.prefix,
    type: 'admin',
    projectId: null,
    environmentId: null,
    description: 'Test root key'
  })
  return generated.plaintext
}

export async function createProject(app: FastifyInstance, rootKey: string, slug = 'test-project') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/projects',
    headers: { authorization: rootKey },
    payload: { name: 'Test Project', slug }
  })
  if (response.statusCode !== 201) {
    throw new Error(response.body)
  }
  return response.json<{ id: string; slug: string }>()
}

export async function createAdminKey(app: FastifyInstance, rootKey: string, projectId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/admin/projects/${projectId}/keys`,
    headers: { authorization: rootKey },
    payload: { type: 'admin', description: 'Project admin' }
  })
  if (response.statusCode !== 201) {
    throw new Error(response.body)
  }
  return response.json<{ key: string; id: string }>().key
}

export async function createClientKey(
  app: FastifyInstance,
  adminKey: string,
  projectId: string,
  environmentId: string
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/admin/projects/${projectId}/keys`,
    headers: { authorization: adminKey },
    payload: { type: 'client', environmentId, description: 'Client' }
  })
  if (response.statusCode !== 201) {
    throw new Error(response.body)
  }
  return response.json<{ key: string; id: string }>().key
}
