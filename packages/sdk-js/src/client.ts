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
/**
 * How long a "this flag does not exist" answer is remembered. Deliberately
 * not an option: the usual cause is code that shipped before someone created
 * the flag, and a few seconds is short enough that nobody needs to tune it.
 */
const MISSING_TTL_SECONDS = 5
const DEFAULT_TIMEOUT_MS = 2000
const RATE_LIMIT_STATUS = 429
/** Used when a 429 arrives with no usable Retry-After header. */
const DEFAULT_BACKOFF_MS = 5_000
/** Ceiling on how long one Retry-After may silence the client. */
const MAX_BACKOFF_MS = 60_000

/** Stands in for the flag key when caching a whole-environment response. */
const BULK_CACHE_KEY = '__all__'

/**
 * Finds one flag inside a cached bulk response. Undefined means the server
 * did not list it, which is its way of saying the flag does not exist.
 */
function findInBulk(features: Feature[], flagKey: string): boolean | undefined {
  return features.find((f) => f.name === flagKey)?.enabled
}

/**
 * Reads a Retry-After header, which HTTP allows to be either a number of
 * seconds or an absolute date. Anything missing or unparseable falls back to
 * a short pause, and every result is capped so one bad header cannot mute the
 * client for hours.
 */
function parseRetryAfter(header: string | null): number {
  const clamp = (ms: number) => Math.min(MAX_BACKOFF_MS, Math.max(0, ms))
  const trimmed = header?.trim()
  if (!trimmed) return DEFAULT_BACKOFF_MS

  const seconds = Number(trimmed)
  if (Number.isFinite(seconds)) return clamp(seconds * 1000)

  const at = Date.parse(trimmed)
  if (!Number.isNaN(at)) return clamp(at - Date.now())

  return DEFAULT_BACKOFF_MS
}

export class FlagraftClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly onStale?: (event: StaleEvent) => void
  private readonly singleCache: TtlCache<EvaluationResult>
  private readonly bulkCache: TtlCache<Feature[]>
  /**
   * Flags the server said it does not have. Keyed by flag key alone, with no
   * context, because whether a flag exists never depends on who is asking --
   * one entry covers every caller.
   */
  private readonly missingCache: TtlCache<true>
  /**
   * Epoch milliseconds until which no request may leave, set from the
   * Retry-After of a 429. Zero means no backoff is in effect.
   */
  private rateLimitedUntil = 0

  constructor(options: FlagraftClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    this.onStale = options.onStale
    const ttl = options.ttl ?? DEFAULT_TTL_SECONDS
    const staleTtl = options.staleTtl ?? DEFAULT_STALE_TTL_SECONDS
    /**
     * ttl 0 means "no SDK caching at all", so it switches the negative cache
     * off too rather than leaving a surprising second cache running.
     */
    const missingTtl = ttl === 0 ? 0 : MISSING_TTL_SECONDS
    this.singleCache = new TtlCache<EvaluationResult>(ttl, staleTtl)
    this.bulkCache = new TtlCache<Feature[]>(ttl, staleTtl)
    this.missingCache = new TtlCache<true>(missingTtl)
  }

  /**
   * Evaluates one flag. `defaultValue` is what you get when the server cannot
   * answer -- an unknown flag, an unreachable server, a timed-out request --
   * and matters for any flag whose safe state is "on", such as a kill switch
   * guarding the path you would fall back to anyway.
   */
  async isEnabled(
    flagKey: string,
    context: EvaluationContext = {},
    defaultValue = false,
  ): Promise<boolean> {
    /**
     * Checked before the per-context cache, since a flag that does not exist
     * is missing for every context and would otherwise be re-asked once per
     * distinct caller. The cache records only that it is missing, so two
     * callers with different defaults each still get their own.
     */
    if (this.missingCache.get(flagKey)) return defaultValue

    const cacheKey = makeKey(flagKey, context)
    const cached = this.singleCache.get(cacheKey)
    if (cached) return cached.enabled

    /**
     * A bulk response already holds every flag for this context, so if one is
     * still fresh the answer is in memory and no request is needed.
     */
    const bulkKey = makeKey(BULK_CACHE_KEY, context)
    const bulk = this.bulkCache.get(bulkKey)
    if (bulk) {
      const enabled = findInBulk(bulk, flagKey)
      if (enabled !== undefined) return enabled
      /**
       * The server builds both endpoints from the same flag map, so a key
       * absent from the bulk list is exactly what the single endpoint would
       * answer 404 for. Recording it here saves that round trip entirely.
       */
      this.missingCache.set(flagKey, true)
      return defaultValue
    }

    try {
      const result = await this.fetchSingle(flagKey, context)
      this.singleCache.set(cacheKey, result)
      return result.enabled
    } catch (error) {
      /**
       * An unknown flag is a real answer rather than an outage, so it falls
       * straight to the default and is remembered briefly. Without that, a
       * mistyped or not yet created flag key means an HTTP round trip on
       * every single call.
       */
      if (error instanceof FlagraftError && error.statusCode === 404) {
        this.missingCache.set(flagKey, true)
        return defaultValue
      }

      /** A real value we fetched earlier always beats a static guess. */
      const stale = this.singleCache.getStale(cacheKey)
      if (stale) {
        this.reportStale(flagKey, stale.storedAt)
        return stale.value.enabled
      }

      /**
       * An expired bulk response is just as real a reading, so it is used
       * before falling back. Without this a caller that hydrates through
       * getFeatures would see it ride out an outage while isEnabled did not.
       */
      const staleBulk = this.bulkCache.getStale(bulkKey)
      if (staleBulk) {
        const enabled = findInBulk(staleBulk.value, flagKey)
        if (enabled !== undefined) {
          this.reportStale(flagKey, staleBulk.storedAt)
          return enabled
        }
      }

      /**
       * A 429 is the server asking us to slow down, not a bug to surface. It
       * behaves like any other outage: stale value if we have one, otherwise
       * the caller's default.
       */
      if (error instanceof FlagraftError && error.statusCode !== RATE_LIMIT_STATUS) throw error
      if (!this.backingOff()) {
        // eslint-disable-next-line no-console
        console.warn(`[flagraft] flag evaluation failed, defaulting to ${defaultValue}`, error)
      }
      return defaultValue
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
    const cacheKey = makeKey(BULK_CACHE_KEY, context)
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

      if (error instanceof FlagraftError && error.statusCode !== RATE_LIMIT_STATUS) throw error
      if (!this.backingOff()) {
        // eslint-disable-next-line no-console
        console.warn('[flagraft] bulk evaluation failed, returning empty list', error)
      }
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

  private backingOff(): boolean {
    return Date.now() < this.rateLimitedUntil
  }

  /**
   * Starts a quiet period after a 429. Logged once here rather than on every
   * suppressed call, because a rate limit usually coincides with high traffic
   * and a per-call warning would flood the log it is trying to inform.
   */
  private startBackoff(retryAfter: string | null): void {
    const ms = parseRetryAfter(retryAfter)
    this.rateLimitedUntil = Date.now() + ms
    // eslint-disable-next-line no-console
    console.warn(`[flagraft] rate limited, pausing requests for ${Math.round(ms / 1000)}s`)
  }

  /** Issues an authenticated GET and parses the JSON body, or throws. */
  private async request<T>(url: string): Promise<T> {
    /**
     * While the server has asked us to back off, nothing goes out. Adding
     * requests to a rate limiter only deepens the hole, and the caller is
     * better served straight away by a stale value or their default.
     */
    if (this.backingOff()) {
      throw new FlagraftError(
        'Backing off after a rate limit',
        RATE_LIMIT_STATUS,
        'TooManyRequests',
      )
    }

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: this.apiKey },
      signal: this.timeoutSignal(),
    })
    if (!response.ok) {
      if (response.status === RATE_LIMIT_STATUS) {
        this.startBackoff(response.headers.get('retry-after'))
      }
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
