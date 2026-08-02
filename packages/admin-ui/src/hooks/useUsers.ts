import { useState, useEffect, useRef } from 'react'
import { usersApi } from '../lib/api'
import type { ListUsersParams, UserCounts, WorkspaceUser } from '../lib/api'

export type UserSortField = 'name' | 'role' | 'projects' | 'last'
export type UserSortDir = 'asc' | 'desc'

const EMPTY_COUNTS: UserCounts = {
  all: 0,
  active: 0,
  invited: 0,
  suspended: 0,
  system: 0,
  owners: 0,
  admins: 0,
}

interface UseUsersOptions extends Omit<ListUsersParams, 'search'> {
  search?: string
}

interface UseUsersResult {
  users: WorkspaceUser[]
  /** Rows matching the filters across every page, for the pager. */
  total: number
  /** Workspace-wide bucket counts; unaffected by the active filters. */
  counts: UserCounts
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches one page of workspace users. Filtering, sorting and paging all
 * happen on the server, so every option change issues a new request.
 */
export function useUsers({
  search = '',
  status,
  role,
  projectId,
  sort = 'name',
  dir = 'asc',
  limit,
  offset,
}: UseUsersOptions): UseUsersResult {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<UserCounts>(EMPTY_COUNTS)
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
    usersApi
      .list({
        limit,
        offset,
        search: search.trim() || undefined,
        status,
        role,
        projectId,
        sort,
        dir,
      })
      .then((res) => {
        if (id !== requestId.current) return
        setUsers(res.data.data)
        setTotal(res.data.total)
        setCounts(res.data.counts)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        /** Non-Error rejections must not surface as an undefined message. */
        setError(err instanceof Error ? err.message : 'Failed to load users')
        setUsers([])
        setTotal(0)
        setLoading(false)
      })
  }, [search, status, role, projectId, sort, dir, limit, offset, tick])

  function refetch() {
    setTick((t) => t + 1)
  }

  return { users, total, counts, loading, error, refetch }
}
