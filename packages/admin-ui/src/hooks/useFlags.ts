import { useState, useEffect, useRef } from 'react'
import { flagsApi } from '../lib/api'
import type { Flag, StateFilter } from '../lib/types'

export type SortField = 'name' | 'updated' | 'key'
export type SortDir = 'asc' | 'desc'

interface UseFlagsOptions {
  projectId: string
  search?: string
  stateFilter?: StateFilter
  /** Environment the state filter applies to. */
  env?: string
  sortField?: SortField
  sortDir?: SortDir
  limit: number
  offset: number
}

interface UseFlagsResult {
  flags: Flag[]
  /** Rows matching the filters across every page, for the pager. */
  total: number
  /** True only for the very first load, when there is nothing to show yet. */
  loading: boolean
  /**
   * True while a later request is in flight -- a filter, sort, search or page
   * change. The previous page stays on screen, so this dims it rather than
   * replacing it.
   */
  refreshing: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches one page of flags. Filtering, sorting and paging all happen on the
 * server, so every option change issues a new request.
 */
export function useFlags({
  projectId,
  search = '',
  stateFilter = null,
  env,
  sortField = 'updated',
  sortDir = 'desc',
  limit,
  offset,
}: UseFlagsOptions): UseFlagsResult {
  const [flags, setFlags] = useState<Flag[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  /** Flips once the first response lands; every fetch after that is a refresh. */
  const settled = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * Responses can arrive out of order when the user types quickly, so only the
   * newest request is allowed to write to state.
   */
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    if (settled.current) setRefreshing(true)
    else setLoading(true)
    setError(null)
    flagsApi
      .list(projectId, {
        limit,
        offset,
        search: search.trim() || undefined,
        state: stateFilter ?? undefined,
        env: stateFilter ? env : undefined,
        sort: sortField,
        dir: sortDir,
      })
      .then((res) => {
        if (id !== requestId.current) return
        setFlags(res.data.data)
        setTotal(res.data.total)
        settled.current = true
        setLoading(false)
        setRefreshing(false)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        /** Non-Error rejections must not surface as an undefined message. */
        setError(err instanceof Error ? err.message : 'Failed to load flags')
        setFlags([])
        setTotal(0)
        settled.current = true
        setLoading(false)
        setRefreshing(false)
      })
  }, [projectId, search, stateFilter, env, sortField, sortDir, limit, offset, tick])

  function refetch() {
    setTick((t) => t + 1)
  }

  return { flags, total, loading, refreshing, error, refetch }
}
