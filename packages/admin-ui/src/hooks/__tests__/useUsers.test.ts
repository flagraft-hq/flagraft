import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useUsers } from '../useUsers'

vi.mock('../../lib/api', () => ({
  usersApi: {
    list: vi.fn(),
  },
}))

import { usersApi } from '../../lib/api'

const mockUsers = [
  { id: 'u1', name: 'Alice', email: 'alice@a.com', role: 'admin' },
  { id: 'u2', name: 'Bob', email: 'bob@a.com', role: 'viewer' },
]

function page(rows: unknown[], counts: Record<string, number> = {}) {
  return {
    data: {
      data: rows,
      total: rows.length,
      limit: 25,
      offset: 0,
      counts: {
        all: rows.length,
        active: 0,
        invited: 0,
        suspended: 0,
        system: 0,
        owners: 0,
        admins: 0,
        ...counts,
      },
    },
  }
}

const listMock = () => usersApi.list as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUsers', () => {
  it('returns loading=true initially', () => {
    listMock().mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useUsers({ limit: 25, offset: 0 }))
    expect(result.current.loading).toBe(true)
  })

  it('returns the page, the total and the workspace counts', async () => {
    listMock().mockResolvedValue(page(mockUsers, { all: 42, admins: 3 }))
    const { result } = renderHook(() => useUsers({ limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.users).toHaveLength(2)
    expect(result.current.total).toBe(2)
    expect(result.current.counts).toMatchObject({ all: 42, admins: 3 })
    expect(result.current.error).toBeNull()
  })

  it('forwards every filter to the API, trimming the search', async () => {
    listMock().mockResolvedValue(page([]))
    const { result } = renderHook(() =>
      useUsers({
        search: '  alice  ',
        status: 'invited',
        role: 'admin',
        projectId: 'p1',
        sort: 'projects',
        dir: 'desc',
        limit: 10,
        offset: 30,
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(usersApi.list).toHaveBeenCalledWith({
      limit: 10,
      offset: 30,
      search: 'alice',
      status: 'invited',
      role: 'admin',
      projectId: 'p1',
      sort: 'projects',
      dir: 'desc',
    })
  })

  it('omits an all-whitespace search rather than sending it', async () => {
    listMock().mockResolvedValue(page([]))
    const { result } = renderHook(() => useUsers({ search: '   ', limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(usersApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }))
  })

  it('surfaces the server error message', async () => {
    listMock().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useUsers({ limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.users).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('falls back to a readable message when the rejection is not an Error', async () => {
    listMock().mockRejectedValue('unexpected')
    const { result } = renderHook(() => useUsers({ limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load users')
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    listMock()
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue(page(mockUsers))

    const { rerender, result } = renderHook(
      (props: { search: string }) => useUsers({ limit: 25, offset: 0, ...props }),
      { initialProps: { search: 'a' } },
    )

    rerender({ search: 'ab' })
    await waitFor(() => expect(result.current.total).toBe(2))

    resolveFirst(page([{ id: 'stale', name: 'Stale' }], { all: 999 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.users.map((u) => u.id)).toEqual(['u1', 'u2'])
  })

  it('refetch triggers a new API call', async () => {
    listMock().mockResolvedValue(page(mockUsers))
    const { result } = renderHook(() => useUsers({ limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(usersApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(2))
  })
})
