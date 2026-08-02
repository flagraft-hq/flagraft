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
  loading: boolean
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
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * Responses can arrive out of order when the user types quickly, so only the
   * newest request is allowed to write to state.
   */
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
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
        setLoading(false)
      })
      .catch((err: Error) => {
        if (id !== requestId.current) return
        setError(err.message)
        setFlags([])
        setTotal(0)
        setLoading(false)
      })
  }, [projectId, search, stateFilter, env, sortField, sortDir, limit, offset, tick])

  function refetch() {
    setTick((t) => t + 1)
  }

  return { flags, total, loading, error, refetch }
}
