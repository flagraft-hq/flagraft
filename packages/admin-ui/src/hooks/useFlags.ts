import { useState, useEffect, useMemo } from 'react'
import { flagsApi } from '../lib/api'
import type { Flag } from '../lib/types'

export type SortField = 'name' | 'updated' | 'key'
export type SortDir = 'asc' | 'desc'

interface UseFlagsOptions {
  projectId: string
  search?: string
  tags?: string[]
  sortField?: SortField
  sortDir?: SortDir
}

interface UseFlagsResult {
  flags: Flag[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFlags({
  projectId,
  search = '',
  tags = [],
  sortField = 'updated',
  sortDir = 'desc',
}: UseFlagsOptions): UseFlagsResult {
  const [allFlags, setAllFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    flagsApi
      .list(projectId)
      .then((res) => {
        if (!cancelled) {
          setAllFlags(res.data)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setAllFlags([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, tick])

  const flags = useMemo(() => {
    let result = allFlags

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (f) => f.name.toLowerCase().includes(lower) || f.key.toLowerCase().includes(lower),
      )
    }

    if (tags.length > 0) {
      result = result.filter((f) => tags.every((t) => f.tags.includes(t)))
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [allFlags, search, tags, sortField, sortDir])

  function refetch() {
    setTick((t) => t + 1)
  }

  return { flags, loading, error, refetch }
}
