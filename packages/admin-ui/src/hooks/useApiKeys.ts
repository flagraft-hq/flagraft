import { useState, useEffect, useCallback, useRef } from 'react'
import { keysApi } from '../lib/api'
import type { ListKeysParams } from '../lib/api'
import type { ApiKey } from '../lib/types'

export type KeySortField = 'created' | 'lastUsed' | 'label'
export type KeySortDir = 'asc' | 'desc'

interface UseApiKeysOptions extends Omit<ListKeysParams, 'search'> {
  projectId: string
  search?: string
}

interface UseApiKeysResult {
  keys: ApiKey[]
  /** Rows matching the filters across every page, for the pager. */
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches one page of a project's API keys. Filtering, sorting and paging all
 * happen on the server. Hashes are never returned by the API.
 */
export function useApiKeys({
  projectId,
  search = '',
  type,
  environmentId,
  sort = 'created',
  dir = 'desc',
  limit,
  offset,
}: UseApiKeysOptions): UseApiKeysResult {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  /**
   * Responses can arrive out of order when the user types quickly, so only the
   * newest request is allowed to write to state.
   */
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)

    keysApi
      .list(projectId, {
        limit,
        offset,
        search: search.trim() || undefined,
        type,
        environmentId,
        sort,
        dir,
      })
      .then((res) => {
        if (id !== requestId.current) return
        setKeys(res.data.data)
        setTotal(res.data.total)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        /** Non-Error rejections must not surface as an undefined message. */
        setError(err instanceof Error ? err.message : 'Failed to load API keys')
        setKeys([])
        setTotal(0)
        setLoading(false)
      })
  }, [projectId, search, type, environmentId, sort, dir, limit, offset, tick])

  return { keys, total, loading, error, refetch }
}
