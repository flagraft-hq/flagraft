import { TtlCache, makeKey } from './cache.js'
import { FlagraftError, type ServerErrorBody } from './errors.js'
import type {
  EvaluationContext,
  EvaluationResult,
  Feature,
  FlagraftClientOptions,
  StaleEvent,
} from './types.js'

const DEFAULT_TTL_SECONDS = 30
const DEFAULT_STALE_TTL_SECONDS = 300
const DEFAULT_TIMEOUT_MS = 2000

export class FlagraftClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly onStale?: (event: StaleEvent) => void
  private readonly singleCache: TtlCache<EvaluationResult>
  private readonly bulkCache: TtlCache<Feature[]>

  constructor(options: FlagraftClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    this.onStale = options.onStale
    const ttl = options.ttl ?? DEFAULT_TTL_SECONDS
    const staleTtl = options.staleTtl ?? DEFAULT_STALE_TTL_SECONDS
    this.singleCache = new TtlCache<EvaluationResult>(ttl, staleTtl)
    this.bulkCache = new TtlCache<Feature[]>(ttl, staleTtl)
  }

  async isEnabled(flagKey: string, context: EvaluationContext = {}): Promise<boolean> {
    const cacheKey = makeKey(flagKey, context)
    const cached = this.singleCache.get(cacheKey)
    if (cached) return cached.enabled

    try {
      const result = await this.fetchSingle(flagKey, context)
      this.singleCache.set(cacheKey, result)
      return result.enabled
    } catch (error) {
      /**
       * An unknown flag is a real answer rather than an outage, so it stays false.
       */
      if (error instanceof FlagraftError && error.statusCode === 404) return false

      const stale = this.singleCache.getStale(cacheKey)
      if (stale) {
        this.reportStale(flagKey, stale.storedAt)
        return stale.value.enabled
      }

      if (error instanceof FlagraftError) throw error
      // eslint-disable-next-line no-console
      console.warn('[flagraft] flag evaluation failed, defaulting to false', error)
      return false
    }
  }

  async getFeatures(context: EvaluationContext = {}): Promise<Record<string, boolean>> {
    const features = await this.getAllFeatures(context)
    return features.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.name] = f.enabled
      return acc
    }, {})
  }

  async getAllFeatures(context: EvaluationContext = {}): Promise<Feature[]> {
    const cacheKey = makeKey('__all__', context)
    const cached = this.bulkCache.get(cacheKey)
    if (cached) return cached

    try {
      const features = await this.fetchAll(context)
      this.bulkCache.set(cacheKey, features)
      return features
    } catch (error) {
      const stale = this.bulkCache.getStale(cacheKey)
      if (stale) {
        this.reportStale(null, stale.storedAt)
        return stale.value
      }

      if (error instanceof FlagraftError) throw error
      // eslint-disable-next-line no-console
      console.warn('[flagraft] bulk evaluation failed, returning empty list', error)
      return []
    }
  }

  /**
   * Tells the host application that a cached value outlived its TTL and was
   * served anyway. A callback that throws must never break flag evaluation,
   * so it is wrapped.
   */
  private reportStale(flagKey: string | null, storedAt: number): void {
    if (!this.onStale) {
      const seconds = Math.round((Date.now() - storedAt) / 1000)
      // eslint-disable-next-line no-console
      console.warn(
        `[flagraft] serving stale value for ${flagKey ?? 'all features'} (fetched ${seconds}s ago)`,
      )
      return
    }
    try {
      this.onStale({ flagKey, fetchedAt: new Date(storedAt) })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[flagraft] onStale callback threw', error)
    }
  }

  /**
   * A fresh signal for every request, because AbortSignal.timeout starts its
   * clock the moment it is created and a shared one would fire early. Returns
   * undefined when timeouts are switched off, or on a runtime old enough to
   * lack AbortSignal.timeout, where no timeout beats a crash.
   */
  private timeoutSignal(): AbortSignal | undefined {
    if (this.timeoutMs === 0) return undefined
    if (typeof AbortSignal?.timeout !== 'function') return undefined
    return AbortSignal.timeout(this.timeoutMs)
  }

  /** Issues an authenticated GET and parses the JSON body, or throws. */
  private async request<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: this.apiKey },
      signal: this.timeoutSignal(),
    })
    if (!response.ok) {
      await this.throwFromResponse(response)
    }
    return (await response.json()) as T
  }

  private async fetchSingle(
    flagKey: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const url = `${this.baseUrl}/api/v1/client/features/${encodeURIComponent(flagKey)}${this.queryString(context)}`
    return this.request<EvaluationResult>(url)
  }

  private async fetchAll(context: EvaluationContext): Promise<Feature[]> {
    const url = `${this.baseUrl}/api/v1/client/features${this.queryString(context)}`
    const body = await this.request<{ features: Feature[] }>(url)
    return body.features
  }

  private queryString(context: EvaluationContext): string {
    const entries = Object.entries(context)
    if (entries.length === 0) return ''
    const params = new URLSearchParams()
    for (const [k, v] of entries) {
      params.set(k, v instanceof Date ? v.toISOString() : String(v))
    }
    return `?${params.toString()}`
  }

  private async throwFromResponse(response: Response): Promise<never> {
    let body: ServerErrorBody | undefined
    try {
      body = (await response.json()) as ServerErrorBody
    } catch {
      // body was not JSON; fall through with a synthetic envelope
    }
    throw new FlagraftError(
      body?.message ?? response.statusText,
      response.status,
      body?.error ?? 'HttpError',
    )
  }
}
