import Fastify from 'fastify'

import { loadConfig } from './config.js'
import type { Cache } from './cache/index.js'
import type { Db } from './db/index.js'
import { clientRoutes } from './modules/client/client.routes.js'
import { environmentRoutes } from './modules/environments/environment.routes.js'
import { flagRoutes } from './modules/flags/flag.routes.js'
import { overrideRoutes } from './modules/flags/override.routes.js'
import { keyRoutes } from './modules/keys/key.routes.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import authPlugin from './plugins/auth.js'
import cachePlugin from './plugins/cache.js'
import dbPlugin from './plugins/db.js'
import errorHandlerPlugin from './plugins/errorHandler.js'

/**
 * Options for configuring the server build
 */
export interface BuildServerOptions {
  /**
   * Optional pre-configured database instance
   */
  db?: Db
  cache?: Cache
}

/**
 * Builds and configures the Fastify server instance
 */
export async function buildServer(opts: BuildServerOptions = {}) {
  const config = loadConfig()
  const fastify = Fastify({
    logger: { level: config.LOG_LEVEL },
  })

  await fastify.register(dbPlugin, { db: opts.db, connectionString: config.DATABASE_URL })
  await fastify.register(cachePlugin, { cache: opts.cache, ttlSeconds: config.CACHE_TTL_SECONDS })
  await fastify.register(errorHandlerPlugin)
  await fastify.register(authPlugin)
  const v1Prefix = { prefix: '/api/v1' }
  await fastify.register(projectRoutes, v1Prefix)
  await fastify.register(environmentRoutes, v1Prefix)
  await fastify.register(flagRoutes, v1Prefix)
  await fastify.register(overrideRoutes, v1Prefix)
  await fastify.register(keyRoutes, v1Prefix)
  await fastify.register(clientRoutes, v1Prefix)

  return fastify
}

/**
 * Starts the server after loading configuration and building the instance
 */
export async function start() {
  const config = loadConfig()
  const server = await buildServer()
  await server.listen({ port: config.PORT, host: '0.0.0.0' })
}

const entrypoint = process.argv[1]?.replace(/\\/g, '/')
if (
  entrypoint?.endsWith('/src/server.ts') ||
  entrypoint?.endsWith('/dist/server.js') ||
  entrypoint?.endsWith('/dist/server.cjs')
) {
  void start().catch((error) => {
    console.error(error) // eslint-disable-line no-console
    process.exit(1)
  })
}
