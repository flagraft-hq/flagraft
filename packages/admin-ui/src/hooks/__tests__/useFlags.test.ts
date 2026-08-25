import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useFlags } from '../useFlags'

vi.mock('../../lib/api', () => ({
  flagsApi: {
    list: vi.fn(),
  },
}))

import { flagsApi } from '../../lib/api'

const mockFlags = [
  {
    key: 'flag-alpha',
    name: 'Alpha Flag',
    description: 'First flag',
    created: '2026-04-01',
    updated: '2026-05-10',
    state: {},
    author: 'alice',
  },
  {
    key: 'flag-bravo',
    name: 'Bravo Feature',
    description: 'Second flag',
    created: '2026-03-15',
    updated: '2026-05-12',
    state: {},
    author: 'bob',
  },
]

/** The hook returns whatever page the server sends; it no longer filters. */
function page(data: unknown[], total = data.length, offset = 0) {
  return { data: { data, total, limit: 25, offset } }
}

const listMock = () => flagsApi.list as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useFlags', () => {
  it('returns loading=true initially', () => {
    listMock().mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', limit: 25, offset: 0 }))
    expect(result.current.loading).toBe(true)
  })

  it('is loading but not refreshing on the very first fetch', () => {
    listMock().mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', limit: 25, offset: 0 }))
    expect(result.current.loading).toBe(true)
    expect(result.current.refreshing).toBe(false)
  })

  it('reports later fetches as refreshing, keeping the previous page in hand', async () => {
    listMock().mockResolvedValue(page(mockFlags, 2))
    const { result, rerender } = renderHook(
      (props: { search: string }) =>
        useFlags({ projectId: 'proj-1', limit: 25, offset: 0, search: props.search }),
      { initialProps: { search: '' } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    /** A filter change must never blank the table out again. */
    listMock().mockReturnValue(new Promise(() => {}))
    rerender({ search: 'alpha' })

    await waitFor(() => expect(result.current.refreshing).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.flags).toHaveLength(2)
  })

  it('clears refreshing once the later fetch lands', async () => {
    listMock().mockResolvedValue(page(mockFlags, 2))
    const { result, rerender } = renderHook(
      (props: { search: string }) =>
        useFlags({ projectId: 'proj-1', limit: 25, offset: 0, search: props.search }),
      { initialProps: { search: '' } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    listMock().mockResolvedValue(page([mockFlags[0]], 1))
    rerender({ search: 'alpha' })

    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(result.current.flags).toHaveLength(1)
  })

  it('stops refreshing when a later fetch fails, and keeps reporting the error', async () => {
    listMock().mockResolvedValue(page(mockFlags, 2))
    const { result, rerender } = renderHook(
      (props: { search: string }) =>
        useFlags({ projectId: 'proj-1', limit: 25, offset: 0, search: props.search }),
      { initialProps: { search: '' } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    listMock().mockRejectedValue(new Error('boom'))
    rerender({ search: 'alpha' })

    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.refreshing).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('returns the page and the unpaged total after a successful fetch', async () => {
    listMock().mockResolvedValue(page(mockFlags, 42))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flags).toHaveLength(2)
    expect(result.current.total).toBe(42)
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    listMock().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.flags).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('forwards paging, search and sort to the API', async () => {
    listMock().mockResolvedValue(page(mockFlags))
    const { result } = renderHook(() =>
      useFlags({
        projectId: 'proj-1',
        search: '  bravo  ',
        sortField: 'name',
        sortDir: 'asc',
        limit: 10,
        offset: 20,
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenCalledWith('proj-1', {
      limit: 10,
      offset: 20,
      search: 'bravo',
      state: undefined,
      env: undefined,
      sort: 'name',
      dir: 'asc',
    })
  })

  it('omits an all-whitespace search rather than sending it', async () => {
    listMock().mockResolvedValue(page([]))
    const { result } = renderHook(() =>
      useFlags({ projectId: 'proj-1', search: '   ', limit: 25, offset: 0 }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ search: undefined }),
    )
  })

  it('sends the environment only when a state filter is active', async () => {
    listMock().mockResolvedValue(page([]))
    const { rerender, result } = renderHook(
      (props: { stateFilter: 'on' | null }) =>
        useFlags({ projectId: 'proj-1', env: 'production', limit: 25, offset: 0, ...props }),
      { initialProps: { stateFilter: null as 'on' | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenLastCalledWith(
      'proj-1',
      expect.objectContaining({ state: undefined, env: undefined }),
    )

    rerender({ stateFilter: 'on' })
    await waitFor(() =>
      expect(flagsApi.list).toHaveBeenLastCalledWith(
        'proj-1',
        expect.objectContaining({ state: 'on', env: 'production' }),
      ),
    )
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    listMock()
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue(page(mockFlags, 2))

    const { rerender, result } = renderHook(
      (props: { search: string }) =>
        useFlags({ projectId: 'proj-1', limit: 25, offset: 0, ...props }),
      { initialProps: { search: 'a' } },
    )

    rerender({ search: 'ab' })
    await waitFor(() => expect(result.current.total).toBe(2))

    /** The first request now lands with different data; it must be dropped. */
    resolveFirst(page([{ key: 'stale' }], 999))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.total).toBe(2)
    expect(result.current.flags.map((f) => f.key)).toEqual(['flag-alpha', 'flag-bravo'])
  })

  it('refetch triggers a new API call', async () => {
    listMock().mockResolvedValue(page(mockFlags))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', limit: 25, offset: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(flagsApi.list).toHaveBeenCalledTimes(2))
  })
})
