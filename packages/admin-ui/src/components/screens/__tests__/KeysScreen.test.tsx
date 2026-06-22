import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeysScreen } from '../KeysScreen'

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

vi.mock('../../../hooks/useApiKeys', () => ({
  useApiKeys: vi.fn(),
}))

const mockToastPush = vi.fn()
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush }),
}))

vi.mock('../../../lib/api', () => ({
  keysApi: { create: vi.fn(), delete: vi.fn() },
}))

import { useProject } from '../../../contexts/ProjectContext'
import { useApiKeys } from '../../../hooks/useApiKeys'
import { keysApi } from '../../../lib/api'

const mockUseProject = useProject as ReturnType<typeof vi.fn>
const mockUseApiKeys = useApiKeys as ReturnType<typeof vi.fn>
const mockKeysApi = keysApi as unknown as {
  create: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const environments = [
  { id: 'e1', slug: 'development', name: 'Development', color: 'teal', protected: false },
]

const adminKey = {
  id: 'k1',
  prefix: 'ff_ad_a91c',
  type: 'admin' as const,
  environmentId: null,
  description: 'CI key',
  lastUsedAt: null,
  createdAt: '2026-05-01',
}

const refetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseProject.mockReturnValue({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo' },
    environments,
    refetchEnvironments: vi.fn(),
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    setActiveProject: vi.fn(),
    loading: false,
    error: null,
  })
  mockUseApiKeys.mockReturnValue({ keys: [adminKey], loading: false, error: null, refetch })
})

describe('KeysScreen', () => {
  it('renders a row per key with scope and prefix', () => {
    render(<KeysScreen />)
    expect(screen.getByText('CI key')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText(/ff_ad_a91c/)).toBeInTheDocument()
    // A key that has never been used shows "Never".
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('shows the empty state when there are no keys', () => {
    mockUseApiKeys.mockReturnValue({ keys: [], loading: false, error: null, refetch })
    render(<KeysScreen />)
    expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument()
  })

  it('issues a client key and reveals the plaintext once', async () => {
    mockKeysApi.create.mockResolvedValue({
      data: { ...adminKey, type: 'client', key: 'ff_secret_plaintext' },
    })
    render(<KeysScreen />)

    fireEvent.click(screen.getByRole('button', { name: /issue key/i }))
    const dialog = screen.getByRole('dialog')

    // Admin scope is default — no environment select shown.
    expect(within(dialog).queryByText('Environment')).not.toBeInTheDocument()

    // Switch to client → environment select appears.
    fireEvent.click(within(dialog).getByRole('button', { name: 'client' }))
    expect(within(dialog).getByText('Environment')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /generate key/i }))

    await waitFor(() =>
      expect(mockKeysApi.create).toHaveBeenCalledWith('p1', {
        type: 'client',
        description: undefined,
        environmentId: 'e1',
      }),
    )
    // The one-time reveal shows the plaintext key.
    expect(await screen.findByText('ff_secret_plaintext')).toBeInTheDocument()
    expect(refetch).toHaveBeenCalled()
  })

  it('surfaces an inline error when issuing fails', async () => {
    mockKeysApi.create.mockRejectedValue(new Error('Server says no'))
    render(<KeysScreen />)
    fireEvent.click(screen.getByRole('button', { name: /issue key/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate key/i }))
    expect(await screen.findByText('Server says no')).toBeInTheDocument()
  })

  it('revokes a key after confirmation', async () => {
    mockKeysApi.delete.mockResolvedValue({})
    render(<KeysScreen />)
    fireEvent.click(screen.getByRole('button', { name: /revoke key/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /revoke key/i }))
    await waitFor(() => expect(mockKeysApi.delete).toHaveBeenCalledWith('p1', 'k1'))
    expect(refetch).toHaveBeenCalled()
  })
})
