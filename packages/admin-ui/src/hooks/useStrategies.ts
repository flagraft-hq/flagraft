import { useCallback, useEffect, useState } from 'react'
import { strategiesApi } from '../lib/api'
import type { Strategy } from '../lib/types'

interface UseStrategiesResult {
  strategies: Strategy[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/** Loads the ordered targeting strategies for one flag + environment. */
export function useStrategies(
  projectId: string,
  flagKey: string,
  env: string,
): UseStrategiesResult {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStrategies = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    strategiesApi
      .list(projectId, flagKey, env)
      .then((res) => {
        if (!cancelled) {
          setStrategies(res.data)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, flagKey, env])

  useEffect(() => fetchStrategies(), [fetchStrategies])

  return { strategies, loading, error, refetch: fetchStrategies }
}
