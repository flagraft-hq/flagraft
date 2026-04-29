import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { createCache, type Cache } from '../cache/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    cache: Cache
  }
}

export interface CachePluginOptions {
  /** Pre-built cache instance -- used in tests to inject a controlled cache. */
  cache?: Cache
  /** TTL in seconds passed to createCache when no cache instance is provided. */
  ttlSeconds?: number
}

async function cachePlugin(fastify: FastifyInstance, opts: CachePluginOptions) {
  const cache = opts.cache ?? createCache(opts.ttlSeconds ?? 30)
  fastify.decorate('cache', cache)
}

export default fp(cachePlugin, { name: 'cache' })
