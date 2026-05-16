import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOverrides } from '../useOverrides'

vi.mock('../../lib/api', () => ({
  overridesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { overridesApi } from '../../lib/api'

const mockOverrides = [
  {
    id: 'ov-1',
    flag: 'my-flag',
    env: 'staging',
    key: 'userId',
    op: 'equals',
    val: 'user-123',
    result: true,
    note: 'test override',
    created: '2026-05-01',
  },
  {
    id: 'ov-2',
    flag: 'my-flag',
    env: 'staging',
    key: 'plan',
    op: 'in',
    val: 'pro,enterprise',
    result: true,
    note: '',
    created: '2026-05-02',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useOverrides', () => {
  it('returns overrides after successful fetch', async () => {
    ;(overridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides })
    const { result } = renderHook(() =>
      useOverrides({ projectId: 'proj-1', flagKey: 'my-flag', env: 'staging' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overrides).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('createOverride calls API and refetches', async () => {
    ;(overridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides })
    ;(overridesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides[0] })
    const { result } = renderHook(() =>
      useOverrides({ projectId: 'proj-1', flagKey: 'my-flag', env: 'staging' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callCountBefore = (overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length
    await act(async () => {
      await result.current.createOverride({
        env: 'staging',
        key: 'userId',
        op: 'equals',
        val: 'new-user',
        result: true,
        note: '',
      })
    })
    expect(overridesApi.create).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect((overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        callCountBefore,
      ),
    )
  })

  it('deleteOverride calls API and refetches', async () => {
    ;(overridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides })
    ;(overridesApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const { result } = renderHook(() =>
      useOverrides({ projectId: 'proj-1', flagKey: 'my-flag', env: 'staging' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callCountBefore = (overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length
    await act(async () => {
      await result.current.deleteOverride('ov-1')
    })
    expect(overridesApi.delete).toHaveBeenCalledWith('proj-1', 'my-flag', 'ov-1')
    await waitFor(() =>
      expect((overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        callCountBefore,
      ),
    )
  })

  it('updateOverride calls API and refetches', async () => {
    ;(overridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides })
    ;(overridesApi.update as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOverrides[0] })
    const { result } = renderHook(() =>
      useOverrides({ projectId: 'proj-1', flagKey: 'my-flag', env: 'staging' }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callCountBefore = (overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length
    await act(async () => {
      await result.current.updateOverride('ov-1', { val: 'updated-user', note: 'updated' })
    })
    expect(overridesApi.update).toHaveBeenCalledWith('proj-1', 'my-flag', 'ov-1', {
      val: 'updated-user',
      note: 'updated',
    })
    await waitFor(() =>
      expect((overridesApi.list as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        callCountBefore,
      ),
    )
  })
})
