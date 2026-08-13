/**
 * Central registry for all cache key patterns.
 * Change key structure here and it propagates everywhere automatically.
 */
export const cacheKeys = {
  /**
   * Key for a project's flag evaluation state scoped to one environment.
   * Used for reads (getOrSet) and targeted invalidation after single-env mutations.
   */
  flagState: (projectId: string, environmentId: string) => `flags:${projectId}:${environmentId}`,

  /**
   * Prefix covering all cached environments for a project.
   * Used for invalidation when a mutation affects every environment (e.g. flag create/delete).
   */
  flagStatePrefix: (projectId: string) => `flags:${projectId}:`,

  /**
   * Key for a looked-up API key, addressed by its stored hash so the plaintext
   * key never becomes a cache key. Invalidated when the key is revoked.
   */
  apiKey: (keyHash: string) => `apikey:${keyHash}`,
}
