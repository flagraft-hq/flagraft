import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { loadConfig } from '../config.js'
import { createDb, type Db } from '../db/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

export interface DbPluginOptions {
  db?: Db
  connectionString?: string
}

async function dbPlugin(fastify: FastifyInstance, opts: DbPluginOptions) {
  if (opts.db) {
    fastify.decorate('db', opts.db)
    return
  }

  const config = loadConfig()
  const db = createDb(opts.connectionString ?? config.DATABASE_URL)
  fastify.decorate('db', db)
  fastify.addHook('onClose', async () => {
    await db.$pool.end()
  })
}

export default fp(dbPlugin, { name: 'db' })
