import { TtlCache, makeKey } from './cache.js'
import { FlagraftError, type ServerErrorBody } from './errors.js'
import type {
  EvaluationContext,
  EvaluationResult,
  Feature,
  FlagraftClientOptions,
} from './types.js'

const DEFAULT_TTL_SECONDS = 30

export class FlagraftClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly singleCache: TtlCache<EvaluationResult>
  private readonly bulkCache: TtlCache<Feature[]>

  constructor(options: FlagraftClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? globalThis.fetch
    const ttl = options.ttl ?? DEFAULT_TTL_SECONDS
    this.singleCache = new TtlCache<EvaluationResult>(ttl)
    this.bulkCache = new TtlCache<Feature[]>(ttl)
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
      if (error instanceof FlagraftError) {
        if (error.statusCode === 404) return false
        throw error
      }
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
      if (error instanceof FlagraftError) throw error
      // eslint-disable-next-line no-console
      console.warn('[flagraft] bulk evaluation failed, returning empty list', error)
      return []
    }
  }

  private async fetchSingle(
    flagKey: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const url = `${this.baseUrl}/api/v1/client/features/${encodeURIComponent(flagKey)}${this.queryString(context)}`
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: this.apiKey },
    })
    if (!response.ok) {
      await this.throwFromResponse(response)
    }
    return (await response.json()) as EvaluationResult
  }

  private async fetchAll(context: EvaluationContext): Promise<Feature[]> {
    const url = `${this.baseUrl}/api/v1/client/features${this.queryString(context)}`
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: this.apiKey },
    })
    if (!response.ok) {
      await this.throwFromResponse(response)
    }
    const body = (await response.json()) as { features: Feature[] }
    return body.features
  }

  private queryString(context: EvaluationContext): string {
    const entries = Object.entries(context)
    if (entries.length === 0) return ''
    const params = new URLSearchParams()
    for (const [k, v] of entries) params.set(k, v)
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
