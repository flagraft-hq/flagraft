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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useApiKeys', () => {
  it('returns loading=true initially', () => {
    asMock(keysApi.list).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useApiKeys('proj-1'))
    expect(result.current.loading).toBe(true)
  })

  it('returns keys after a successful fetch', async () => {
    asMock(keysApi.list).mockResolvedValue({ data: mockKeys })
    const { result } = renderHook(() => useApiKeys('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.keys).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error on fetch failure', async () => {
    asMock(keysApi.list).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useApiKeys('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.keys).toHaveLength(0)
  })

  it('refetch triggers a new fetch', async () => {
    asMock(keysApi.list).mockResolvedValue({ data: mockKeys })
    const { result } = renderHook(() => useApiKeys('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(keysApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(keysApi.list).toHaveBeenCalledTimes(2))
  })
})
