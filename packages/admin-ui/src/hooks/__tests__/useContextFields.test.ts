import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useContextFields } from '../useContextFields'

vi.mock('../../lib/api', () => ({
  contextFieldsApi: {
    list: vi.fn(),
  },
}))

import { contextFieldsApi } from '../../lib/api'

const mockFields = [
  {
    key: 'userId',
    type: 'string' as const,
    source: 'sdk' as const,
    required: true,
    example: 'user-123',
    desc: 'User identifier',
    usedIn: 5,
  },
  {
    key: 'plan',
    type: 'enum' as const,
    source: 'server' as const,
    required: false,
    example: 'pro',
    desc: 'Subscription plan',
    enumValues: ['free', 'pro', 'enterprise'],
    usedIn: 3,
  },
  {
    key: 'betaEnabled',
    type: 'boolean' as const,
    source: 'computed' as const,
    required: false,
    example: 'true',
    desc: 'Beta feature access',
    usedIn: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useContextFields', () => {
  it('returns fields after successful fetch', async () => {
    ;(contextFieldsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFields })
    const { result } = renderHook(() => useContextFields('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.fields).toHaveLength(3)
    expect(result.current.error).toBeNull()
  })

  it('getField returns the correct field by key', async () => {
    ;(contextFieldsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFields })
    const { result } = renderHook(() => useContextFields('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const field = result.current.getField('plan')
    expect(field).toBeDefined()
    expect(field?.key).toBe('plan')
    expect(field?.type).toBe('enum')
  })

  it('getField returns undefined for an unknown key', async () => {
    ;(contextFieldsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockFields })
    const { result } = renderHook(() => useContextFields('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const field = result.current.getField('nonExistentKey')
    expect(field).toBeUndefined()
  })
})
