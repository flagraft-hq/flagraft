import type { EvaluationContext } from './types.js'

export function makeKey(flagKey: string, context: EvaluationContext): string {
  const sorted = Object.keys(context)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = context[k]
      return acc
    }, {})
  return `${flagKey}:${JSON.stringify(sorted)}`
}

interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>()
  private readonly ttlMs: number

  constructor(ttlSeconds: number) {
    this.ttlMs = Math.max(0, ttlSeconds) * 1000
  }

  get(key: string): T | undefined {
    if (this.ttlMs === 0) return undefined
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    if (this.ttlMs === 0) return
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
