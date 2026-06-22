import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useEnvironments } from '../useEnvironments'

vi.mock('../../lib/api', () => ({
  flagsApi: { list: vi.fn() },
  environmentsApi: { list: vi.fn() },
}))

import { flagsApi, environmentsApi } from '../../lib/api'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

/** Two flags with per-env on/off state used to derive the env list and counts. */
const mockFlags = [
  { key: 'a', name: 'A', state: { development: { on: true }, production: { on: false } } },
  { key: 'b', name: 'B', state: { development: { on: true }, production: { on: true } } },
]

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no environment metadata endpoint data; envs derived from flags.
  asMock(environmentsApi.list).mockResolvedValue({ data: [] })
})

describe('useEnvironments', () => {
  it('returns loading=true initially', () => {
    asMock(flagsApi.list).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useEnvironments('proj-1'))
    expect(result.current.loading).toBe(true)
  })

  it('derives environments from flag state with per-env stats', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const bySlug = Object.fromEntries(result.current.environments.map((e) => [e.slug, e]))
    expect(Object.keys(bySlug).sort()).toEqual(['development', 'production'])
    // Flags count is the project total (same across envs); defaultOn counts on-by-default.
    expect(bySlug.development.flags).toBe(2)
    expect(bySlug.development.defaultOn).toBe(2)
    expect(bySlug.production.defaultOn).toBe(1)
    // Client-key counts are not exposed by the API — reported as null, not guessed.
    expect(bySlug.production.clientKeys).toBeNull()
  })

  it('orders dev → staging → production, then unknown envs alphabetically', async () => {
    asMock(flagsApi.list).mockResolvedValue({
      data: [
        { key: 'a', name: 'A', state: { production: { on: false }, staging: { on: false }, development: { on: false }, zeta: { on: false }, alpha: { on: false } } },
      ],
    })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.environments.map((e) => e.slug)).toEqual([
      'development',
      'staging',
      'production',
      'alpha',
      'zeta',
    ])
  })

  it('marks production as protected by default when no metadata is present', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const prod = result.current.environments.find((e) => e.slug === 'production')!
    const dev = result.current.environments.find((e) => e.slug === 'development')!
    expect(prod.protected).toBe(true)
    expect(dev.protected).toBe(false)
  })

  it('prefers environment metadata (name/color/protected) over derived values', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: mockFlags })
    asMock(environmentsApi.list).mockResolvedValue({
      data: [{ id: 'e1', slug: 'production', name: 'Prod Custom', color: 'amber', protected: false }],
    })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const prod = result.current.environments.find((e) => e.slug === 'production')!
    expect(prod.name).toBe('Prod Custom')
    expect(prod.color).toBe('amber')
    expect(prod.protected).toBe(false)
  })

  it('falls back to development + production when no flags or metadata exist', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: [] })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.environments.map((e) => e.slug)).toEqual(['development', 'production'])
  })

  it('still derives envs from flags when the metadata endpoint fails', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: mockFlags })
    asMock(environmentsApi.list).mockRejectedValue(new Error('no env endpoint'))
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.environments.map((e) => e.slug).sort()).toEqual([
      'development',
      'production',
    ])
  })

  it('surfaces an error when the flags fetch fails', async () => {
    asMock(flagsApi.list).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.environments).toHaveLength(0)
  })

  it('refetch triggers a new fetch', async () => {
    asMock(flagsApi.list).mockResolvedValue({ data: mockFlags })
    const { result } = renderHook(() => useEnvironments('proj-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(flagsApi.list).toHaveBeenCalledTimes(1)
    result.current.refetch()
    await waitFor(() => expect(flagsApi.list).toHaveBeenCalledTimes(2))
  })
})
