import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useApiKeys } from '../useApiKeys'

vi.mock('../../lib/api', () => ({
  keysApi: { list: vi.fn() },
}))

import { keysApi } from '../../lib/api'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const mockKeys = [
  {
    id: 'k1',
    prefix: 'ff_ad_a91c',
    type: 'admin',
    environmentId: null,
    description: 'CI',
    lastUsedAt: null,
    createdAt: '2026-05-01',
  },
]

function page(rows: unknown[], total = rows.length) {
  return { data: { data: rows, total, limit: 25, offset: 0 } }
}

const opts = { projectId: 'proj-1', limit: 25, offset: 0 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useApiKeys', () => {
  it('returns loading=true initially', () => {
    asMock(keysApi.list).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useApiKeys(opts))
    expect(result.current.loading).toBe(true)
  })

  it('returns keys after a successful fetch', async () => {
    asMock(keysApi.list).mockResolvedValue(page(mockKeys))
    const { result } = renderHook(() => useApiKeys(opts))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.keys).toHaveLength(1)
    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('forwards paging and filters to the API, trimming the search', async () => {
    asMock(keysApi.list).mockResolvedValue(page([]))
    const { result } = renderHook(() =>
      useApiKeys({
        projectId: 'proj-1',
        search: '  ci  ',
        type: 'client',
        environmentId: 'env-1',
        sort: 'lastUsed',
        dir: 'asc',
        limit: 10,
        offset: 20,
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(keysApi.list).toHaveBeenCalledWith('proj-1', {
      limit: 10,
      offset: 20,
      search: 'ci',
      type: 'client',
      environmentId: 'env-1',
      sort: 'lastUsed',
      dir: 'asc',
    })
  })

  it('omits an all-whitespace search rather than sending it', async () => {
    asMock(keysApi.list).mockResolvedValue(page([]))
    const { result } = renderHook(() => useApiKeys({ ...opts, search: '   ' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(keysApi.list).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ search: undefined }),
    )
  })

  it('falls back to a readable message when the rejection is not an Error', async () => {
    asMock(keysApi.list).mockRejectedValue('unexpected')
    const { result } = renderHook(() => useApiKeys(opts))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load API keys')
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    asMock(keysApi.list)
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue(page(mockKeys, 1))

    const { rerender, result } = renderHook(
      (props: { search: string }) => useApiKeys({ ...opts, ...props }),
      { initialProps: { search: 'a' } },
    )
    rerender({ search: 'ab' })
    await waitFor(() => expect(result.current.total).toBe(1))

    resolveFirst(page([{ id: 'stale' }], 999))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.total).toBe(1)
    expect(result.current.keys.map((k) => k.id)).toEqual(['k1'])
  })

  it('surfaces an error on fetch failure', async () => {
    asMock(keysApi.list).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useApiKeys(opts))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.keys).toHaveLength(0)
  })

  it('refetch triggers a new fetch', async () => {
    asMock(keysApi.list).mockResolvedValue(page(mockKeys))
    const { result } = renderHook(() => useApiKeys(opts))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(keysApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(keysApi.list).toHaveBeenCalledTimes(2))
  })
})
