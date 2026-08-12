import { MAX_CACHE_ENTRIES } from './constants.js'
import type { ContextValue, EvaluationContext } from './types.js'

export function makeKey(flagKey: string, context: EvaluationContext): string {
  const sorted = Object.keys(context)
    .sort()
    .reduce<Record<string, ContextValue>>((acc, k) => {
      acc[k] = context[k]
      return acc
    }, {})
  return `${flagKey}:${JSON.stringify(sorted)}`
}

interface Entry<T> {
  value: T
  storedAt: number
}

export interface StaleHit<T> {
  value: T
  /** Epoch milliseconds at which the value was stored. */
  storedAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>()
  private readonly ttlMs: number
  private readonly staleTtlMs: number
  private readonly maxEntries: number

  constructor(ttlSeconds: number, staleTtlSeconds = 0, maxEntries = MAX_CACHE_ENTRIES) {
    this.ttlMs = Math.max(0, ttlSeconds) * 1000
    this.staleTtlMs = Math.max(0, staleTtlSeconds) * 1000
    this.maxEntries = Math.min(MAX_CACHE_ENTRIES, Math.max(1, maxEntries))
  }

  /** Entries currently held. Exposed so tests can assert the cap holds. */
  get size(): number {
    return this.store.size
  }

  /**
   * Looks up an entry and drops it if it is past even the stale window.
   * Returns the age alongside it so callers can decide whether it counts as
   * fresh or only as a fallback.
   */
  private read(key: string): { entry: Entry<T>; age: number } | undefined {
    if (this.ttlMs === 0) return undefined
    const entry = this.store.get(key)
    if (!entry) return undefined
    const age = Date.now() - entry.storedAt
    if (age >= this.ttlMs + this.staleTtlMs) {
      this.store.delete(key)
      return undefined
    }
    return { entry, age }
  }

  /** Returns the value only while it is still fresh. */
  get(key: string): T | undefined {
    const hit = this.read(key)
    if (!hit || hit.age >= this.ttlMs) return undefined
    return hit.entry.value
  }

  /**
   * Returns an expired value that is still inside the stale window, so a
   * caller whose refetch just failed can fall back to it. Never returns a
   * fresh value, because get() already covers that case.
   */
  getStale(key: string): StaleHit<T> | undefined {
    const hit = this.read(key)
    if (!hit || hit.age < this.ttlMs) return undefined
    return { value: hit.entry.value, storedAt: hit.entry.storedAt }
  }

  set(key: string, value: T): void {
    if (this.ttlMs === 0) return
    /**
     * Deleting first makes a refreshed key count as the newest again. A Map
     * keeps a key in its original position when you overwrite it, so without
     * this a frequently read key would still be the first one evicted.
     */
    this.store.delete(key)
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, storedAt: Date.now() })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
