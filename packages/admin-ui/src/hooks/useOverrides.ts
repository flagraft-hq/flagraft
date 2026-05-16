import { useState, useEffect, useCallback } from 'react'
import { overridesApi } from '../lib/api'
import type { Override } from '../lib/types'

interface UseOverridesOptions {
  projectId: string
  flagKey: string
  env: string
}

interface UseOverridesResult {
  overrides: Override[]
  loading: boolean
  error: string | null
  createOverride: (data: Omit<Override, 'id' | 'flag' | 'created'>) => Promise<void>
  updateOverride: (
    id: string,
    data: Partial<Omit<Override, 'id' | 'flag' | 'created'>>,
  ) => Promise<void>
  deleteOverride: (id: string) => Promise<void>
  refetch: () => void
}

export function useOverrides({ projectId, flagKey, env }: UseOverridesOptions): UseOverridesResult {
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    overridesApi
      .list(projectId, flagKey, env)
      .then((res) => {
        if (!cancelled) {
          setOverrides(res.data)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setOverrides([])
          setError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, flagKey, env, tick])

  const refetch = useCallback(() => setTick((n) => n + 1), [])

  const createOverride = useCallback(
    async (data: Omit<Override, 'id' | 'flag' | 'created'>) => {
      await overridesApi.create(projectId, flagKey, data)
      refetch()
    },
    [projectId, flagKey, refetch],
  )

  const updateOverride = useCallback(
    async (id: string, data: Partial<Omit<Override, 'id' | 'flag' | 'created'>>) => {
      await overridesApi.update(projectId, flagKey, id, data)
      refetch()
    },
    [projectId, flagKey, refetch],
  )

  const deleteOverride = useCallback(
    async (id: string) => {
      await overridesApi.delete(projectId, flagKey, id)
      refetch()
    },
    [projectId, flagKey, refetch],
  )

  return { overrides, loading, error, createOverride, updateOverride, deleteOverride, refetch }
}
