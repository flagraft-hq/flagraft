import Fastify from 'fastify'

import { loadConfig } from './config.js'
import type { Db } from './db/index.js'
import { clientRoutes } from './modules/client/client.routes.js'
import { environmentRoutes } from './modules/environments/environment.routes.js'
import { flagRoutes } from './modules/flags/flag.routes.js'
import { overrideRoutes } from './modules/flags/override.routes.js'
import { keyRoutes } from './modules/keys/key.routes.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import authPlugin from './plugins/auth.js'
import dbPlugin from './plugins/db.js'
import errorHandlerPlugin from './plugins/errorHandler.js'

export interface BuildServerOptions {
  db?: Db
}

export async function buildServer(opts: BuildServerOptions = {}) {
  const config = loadConfig()
  const fastify = Fastify({
    logger: { level: config.LOG_LEVEL },
  })

  await fastify.register(dbPlugin, { db: opts.db, connectionString: config.DATABASE_URL })
  await fastify.register(errorHandlerPlugin)
  await fastify.register(authPlugin)
  await fastify.register(projectRoutes)
  await fastify.register(environmentRoutes)
  await fastify.register(flagRoutes)
  await fastify.register(overrideRoutes)
  await fastify.register(keyRoutes)
  await fastify.register(clientRoutes)

  return fastify
}

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
