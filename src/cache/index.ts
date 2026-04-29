import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

/**
 * Cache interface used throughout the application.
 * All cache implementations must satisfy this contract.
 */
export interface Cache {
  getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T>
  delete(key: string): Promise<void>
  deleteByPrefix(prefix: string): Promise<void>
}

/**
 * Creates an in-memory cache backed by BentoCache.
 *
 * We track all cached keys in a Set so deleteByPrefix can find matches --
 * BentoCache's memory driver does not expose a native prefix-scan API.
 */
export function createCache(ttlSeconds: number): Cache {
  const bento = new BentoCache({
    default: 'memory',
    stores: {
      memory: bentostore().useL1Layer(memoryDriver()),
    },
  })

  const ttl = `${ttlSeconds}s`
  const knownKeys = new Set<string>()

  return {
    async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
      knownKeys.add(key)
      return bento.getOrSet({ key, factory, ttl })
    },

    async delete(key: string): Promise<void> {
      knownKeys.delete(key)
      await bento.delete({ key })
    },

    async deleteByPrefix(prefix: string): Promise<void> {
      const targets = [...knownKeys].filter((k) => k.startsWith(prefix))
      await Promise.all(targets.map((k) => this.delete(k)))
    },
  }
}
