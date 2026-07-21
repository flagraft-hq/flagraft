import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'

import { USER_ROLES } from './auth/constants.js'
import { loadConfig, type AppConfig } from './config.js'
import type { Cache } from './cache/index.js'
import type { Db } from './db/index.js'
import { createUser } from './modules/auth/auth.service.js'
import { createProject } from './modules/projects/project.service.js'
import { users, projects } from './db/schema.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { clientRoutes } from './modules/client/client.routes.js'
import { contextFieldRoutes } from './modules/context-fields/context-field.routes.js'
import { environmentRoutes } from './modules/environments/environment.routes.js'
import { flagRoutes } from './modules/flags/flag.routes.js'
import { keyRoutes } from './modules/keys/key.routes.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import { strategyRoutes } from './modules/strategies/strategy.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { publicRoutes } from './modules/public/public.routes.js'
import authPlugin from './plugins/auth.js'
import cachePlugin from './plugins/cache.js'
import dbPlugin from './plugins/db.js'
import errorHandlerPlugin from './plugins/errorHandler.js'
import healthPlugin from './plugins/health.js'
import requestIdPlugin from './plugins/requestId.js'
import swaggerPlugin from './plugins/swagger.js'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
  }
}

/**
 * Options for configuring the server build
 */
export interface BuildServerOptions {
  /**
   * Optional pre-configured database instance
   */
  db?: Db
  cache?: Cache
  /**
   * Skips the first-boot seeding of the default admin and project.
   * Used by tests whose premise is an empty or unavailable database.
   */
  skipBootSeed?: boolean
}

/**
 * Builds and configures the Fastify server instance
 */
export async function buildServer(opts: BuildServerOptions = {}) {
  const config = loadConfig()
  const fastify = Fastify({
    logger: { level: config.LOG_LEVEL },
  })
  fastify.decorate('config', config)

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  })

  if (config.NODE_ENV !== 'production') {
    await fastify.register(swaggerPlugin)
  }

  await fastify.register(dbPlugin, { db: opts.db, connectionString: config.DATABASE_URL })
  await fastify.register(cachePlugin, { cache: opts.cache, ttlSeconds: config.CACHE_TTL_SECONDS })
  await fastify.register(errorHandlerPlugin)
  await fastify.register(requestIdPlugin)
  await fastify.register(cookie)
  await fastify.register(jwt, { secret: config.JWT_SECRET })
  await fastify.register(authPlugin)
  await fastify.register(healthPlugin)
  const v1Prefix = { prefix: '/api/v1' }
  await fastify.register(projectRoutes, v1Prefix)
  await fastify.register(environmentRoutes, v1Prefix)
  await fastify.register(flagRoutes, v1Prefix)
  await fastify.register(contextFieldRoutes, v1Prefix)
  await fastify.register(strategyRoutes, v1Prefix)
  await fastify.register(keyRoutes, v1Prefix)
  await fastify.register(clientRoutes, v1Prefix)
  await fastify.register(userRoutes, v1Prefix)
  await fastify.register(authRoutes, v1Prefix)
  await fastify.register(publicRoutes, v1Prefix)

  fastify.addHook('onReady', async () => {
    if (opts.skipBootSeed) return
    const [existingUser] = await fastify.db.select().from(users).limit(1)
    if (!existingUser) {
      await createUser(fastify.db, {
        email: config.DEFAULT_ADMIN_EMAIL,
        password: config.DEFAULT_ADMIN_PASSWORD,
        name: config.DEFAULT_ADMIN_NAME,
        role: USER_ROLES.OWNER,
        status: 'active',
      })
      fastify.log.info(
        { email: config.DEFAULT_ADMIN_EMAIL },
        'First boot: created default admin user. Change the password after logging in.',
      )
    }

    const [existingProject] = await fastify.db.select().from(projects).limit(1)
    if (!existingProject) {
      await createProject(fastify.db, {
        name: config.DEFAULT_PROJECT_NAME,
        slug: config.DEFAULT_PROJECT_SLUG,
      })
      fastify.log.info(
        { slug: config.DEFAULT_PROJECT_SLUG },
        'First boot: created default project.',
      )
    }
  })

  return fastify
}

/**
 * Starts the server after loading configuration and building the instance
 */
export async function start() {
  const config = loadConfig()
  const server = await buildServer()
  await server.listen({ port: config.PORT, host: '0.0.0.0' })

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'shutting down')
    await server.close()
    process.exit(0)
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
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
