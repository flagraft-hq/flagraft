import { useState, useEffect, useCallback } from 'react'
import { keysApi } from '../lib/api'
import type { ApiKey } from '../lib/types'

interface UseApiKeysResult {
  keys: ApiKey[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/** Loads the API keys for a project. Hashes are never returned by the API. */
export function useApiKeys(projectId: string): UseApiKeysResult {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    keysApi
      .list(projectId)
      .then((res) => {
        if (cancelled) return
        setKeys(res.data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setKeys([])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, tick])

  return { keys, loading, error, refetch }
}
