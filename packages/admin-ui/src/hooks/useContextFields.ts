import { useState, useEffect, useCallback } from 'react'
import { contextFieldsApi } from '../lib/api'
import type { ContextField } from '../lib/types'

interface UseContextFieldsResult {
  fields: ContextField[]
  loading: boolean
  error: string | null
  getField: (key: string) => ContextField | undefined
  refetch: () => void
}

export function useContextFields(projectId: string): UseContextFieldsResult {
  const [fields, setFields] = useState<ContextField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFields = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    contextFieldsApi
      .list(projectId)
      .then((res) => {
        if (!cancelled) {
          setFields(res.data)
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
  }, [projectId])

  useEffect(() => fetchFields(), [fetchFields])

  function getField(key: string): ContextField | undefined {
    return fields.find((f) => f.key === key)
  }

  return { fields, loading, error, getField, refetch: fetchFields }
}
