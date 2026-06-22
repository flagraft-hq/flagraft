import { useState, useEffect, useCallback } from 'react'
import { environmentsApi, flagsApi } from '../lib/api'
import type { Env, EnvColor } from '../lib/types'

/** An environment enriched with the per-env stats shown on the cards. */
export interface EnvWithStats {
  id: string
  slug: string
  name: string
  color: EnvColor
  protected: boolean
  /** Total flags in the project (same across envs). */
  flags: number
  /** Flags whose default state is on in this environment. */
  defaultOn: number
  /** Client API keys scoped to this env — null when no key data is available. */
  clientKeys: number | null
}

interface UseEnvironmentsResult {
  environments: EnvWithStats[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/** Preferred display order; unknown envs fall after these, alphabetically. */
const ENV_ORDER = ['development', 'staging', 'production']

function envColorFor(slug: string): EnvColor {
  if (slug === 'production' || slug.endsWith('production')) return 'red'
  if (slug === 'staging' || slug.endsWith('staging')) return 'amber'
  if (slug === 'development' || slug.endsWith('development')) return 'teal'
  return 'slate'
}

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/**
 * Sources the environment list and its stats. The list of environments and the
 * Flags / On-by-default counts are derived from the real flags data, so the
 * screen always reflects actual state. Environment metadata (display name,
 * color, protected flag) is taken from the environments endpoint when present,
 * otherwise derived from the slug. Client-key counts are not yet exposed by the
 * API, so they are reported as null rather than guessed.
 */
export function useEnvironments(projectId: string): UseEnvironmentsResult {
  const [environments, setEnvironments] = useState<EnvWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    flagsApi
      .list(projectId)
      .then(async (flagsRes) => {
        const flags = flagsRes.data
        const slugs = new Set<string>()
        flags.forEach((f) => Object.keys(f.state ?? {}).forEach((s) => slugs.add(s)))

        /** Prefer real environment metadata; fall back to deriving it from slugs. */
        let meta: Env[]
        try {
          const res = await environmentsApi.list(projectId)
          meta = res.data
          meta.forEach((m) => slugs.add(m.slug))
        } catch {
          meta = []
        }
        const metaBySlug = new Map(meta.map((m) => [m.slug, m]))

        if (slugs.size === 0) {
          ;['development', 'production'].forEach((s) => slugs.add(s))
        }

        const ordered = [...slugs].sort((a, b) => {
          const ia = ENV_ORDER.indexOf(a)
          const ib = ENV_ORDER.indexOf(b)
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          return a.localeCompare(b)
        })

        const list: EnvWithStats[] = ordered.map((slug) => {
          const m = metaBySlug.get(slug)
          return {
            id: m?.id ?? slug,
            slug,
            name: m?.name ?? titleCase(slug),
            color: m?.color ?? envColorFor(slug),
            protected: m?.protected ?? slug === 'production',
            flags: flags.length,
            defaultOn: flags.filter((f) => f.state?.[slug]?.on).length,
            clientKeys: null,
          }
        })

        if (!cancelled) {
          setEnvironments(list)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setEnvironments([])
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectId, tick])

  return { environments, loading, error, refetch }
}
