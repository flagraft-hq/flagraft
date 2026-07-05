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
    tags: ['core', 'beta'],
    created: '2026-04-01',
    updated: '2026-05-10',
    state: {},
    author: 'alice',
  },
  {
    key: 'flag-bravo',
    name: 'Bravo Feature',
    description: 'Second flag',
    tags: ['beta'],
    created: '2026-03-15',
    updated: '2026-05-12',
    state: {},
    author: 'bob',
  },
  {
    key: 'flag-charlie',
    name: 'Charlie Toggle',
    description: 'Third flag',
    tags: ['core', 'experiment'],
    created: '2026-02-20',
    updated: '2026-04-28',
    state: {},
    author: 'charlie',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useFlags', () => {
  it('returns loading=true initially', () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1' }))
    expect(result.current.loading).toBe(true)
  })

  it('returns flags after successful fetch', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flags).toHaveLength(3)
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.flags).toHaveLength(0)
  })

  it('filters by search term matching flag name', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', search: 'bravo' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flags).toHaveLength(1)
    expect(result.current.flags[0].key).toBe('flag-bravo')
  })

  it('filters by search term matching flag key', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', search: 'charlie' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flags).toHaveLength(1)
    expect(result.current.flags[0].key).toBe('flag-charlie')
  })

  it('filters by tags matching any selected tag (OR semantics)', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() =>
      useFlags({ projectId: 'proj-1', tags: ['beta', 'experiment'] }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    // OR semantics (matches the design): alpha + bravo carry 'beta', charlie carries
    // 'experiment'. No single flag has both tags, so AND semantics would return zero.
    const keys = result.current.flags.map((f) => f.key).sort()
    expect(keys).toEqual(['flag-alpha', 'flag-bravo', 'flag-charlie'])
  })

  it('filters by search term matching flag description', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1', search: 'second' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flags).toHaveLength(1)
    expect(result.current.flags[0].key).toBe('flag-bravo')
  })

  it('sorts by name ascending', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() =>
      useFlags({ projectId: 'proj-1', sortField: 'name', sortDir: 'asc' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const names = result.current.flags.map((f) => f.name)
    expect(names).toEqual(['Alpha Flag', 'Bravo Feature', 'Charlie Toggle'])
  })

  it('refetch triggers a new API call', async () => {
    ;(flagsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useFlags({ projectId: 'proj-1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(flagsApi.list).toHaveBeenCalledTimes(2))
  })
})
