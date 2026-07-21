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
    id: 'cf-1',
    key: 'userId',
    type: 'string' as const,
    description: 'User identifier',
    enumValues: null,
  },
  {
    id: 'cf-2',
    key: 'plan',
    type: 'enum' as const,
    description: 'Subscription plan',
    enumValues: ['free', 'pro', 'enterprise'],
  },
  {
    id: 'cf-3',
    key: 'betaEnabled',
    type: 'boolean' as const,
    description: 'Beta feature access',
    enumValues: null,
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
