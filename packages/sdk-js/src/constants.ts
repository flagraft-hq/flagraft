/**
 * Every default and fixed value the SDK relies on, gathered so that "what
 * does this do when I configure nothing?" is answerable from one file.
 */

/* -------------------------------------------------------------------------- */
/* Caching                                                                     */
/* -------------------------------------------------------------------------- */

/** How long a fetched value counts as fresh, when the caller sets no `ttl`. */
export const DEFAULT_TTL_SECONDS = 30

/**
 * How long an expired value stays usable as a fallback after a failed
 * refetch, when the caller sets no `staleTtl`.
 */
export const DEFAULT_STALE_TTL_SECONDS = 300

/**
 * How long a "this flag does not exist" answer is remembered. Deliberately
 * not an option: the usual cause is code that shipped before someone created
 * the flag, and a few seconds is short enough that nobody needs to tune it.
 */
export const MISSING_TTL_SECONDS = 5

/**
 * How many entries a cache may hold before the oldest one is dropped. The
 * cache key includes the whole evaluation context, so an app that passes a
 * per-user context would otherwise add one entry per user and never shrink.
 */
export const MAX_CACHE_ENTRIES = 10_000

/** Stands in for the flag key when caching a whole-environment response. */
export const BULK_CACHE_KEY = '__all__'

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

/** How long one request may take before it is aborted, absent `timeoutMs`. */
export const DEFAULT_TIMEOUT_MS = 2000

export const RATE_LIMIT_STATUS = 429
export const NOT_MODIFIED_STATUS = 304

/** Used when a 429 arrives with no usable Retry-After header. */
export const DEFAULT_BACKOFF_MS = 5_000

/** Ceiling on how long one Retry-After may silence the client. */
export const MAX_BACKOFF_MS = 60_000
