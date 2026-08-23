import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeysScreen } from '../KeysScreen'

/** Role gating has its own tests; these render as an owner so nothing is disabled. */
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'owner',
    canWrite: true,
    canProjectAdmin: true,
    canOwnerAct: true,
    canWriteEnv: () => true,
  }),
}))

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
  apiBaseUrl: 'https://flags.example.com/api/v1',
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
  expiresAt: null,
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
  mockUseApiKeys.mockReturnValue({
    keys: [adminKey],
    total: 1,
    loading: false,
    error: null,
    refetch,
  })
})

/**
 * HeroUI's table is React Aria's, which exposes `role="grid"` rather than
 * `role="table"`. Several assertions need to scope themselves to the rows, so
 * they go through this rather than a class name.
 */
const getTable = () => screen.getByRole('grid', { name: 'API keys' })

/**
 * HeroUI's select is a button that opens a listbox, not a native `<select>`,
 * so a value cannot be set with `fireEvent.change`. Open it and pick.
 */
function chooseOption(selectLabel: string, optionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectLabel) }))
  fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('KeysScreen', () => {
  it('renders a row per key with scope and prefix', () => {
    render(<KeysScreen />)
    expect(screen.getByText('CI key')).toBeInTheDocument()
    /** "admin" also appears as a scope-filter option, so scope to the table. */
    expect(within(getTable()).getByText('admin')).toBeInTheDocument()
    expect(screen.getByText(/ff_ad_a91c/)).toBeInTheDocument()
    /** "Never" appears both for "last used" and for a key with no expiry set. */
    expect(within(getTable()).getAllByText('Never')).toHaveLength(2)
  })

  it('renders one grid row per key, plus the header row', () => {
    mockUseApiKeys.mockReturnValue({
      keys: [adminKey, { ...adminKey, id: 'k2', prefix: 'ff_cl_77b2', description: 'SDK key' }],
      total: 2,
      loading: false,
      error: null,
      refetch,
    })
    render(<KeysScreen />)
    expect(within(getTable()).getAllByRole('row')).toHaveLength(3)
    expect(within(getTable()).getAllByRole('columnheader')).toHaveLength(7)
  })

  it('renders the pager and filter controls', () => {
    mockUseApiKeys.mockReturnValue({
      keys: [adminKey],
      total: 60,
      loading: false,
      error: null,
      refetch,
    })
    render(<KeysScreen />)
    expect(screen.getByText('1–25 of 60 keys')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scope filter/ })).toHaveTextContent('All scopes')
    expect(screen.getByRole('button', { name: /Environment filter/ })).toHaveTextContent(
      'All environments',
    )
  })

  it('passes the search, scope and environment filters to the hook', async () => {
    render(<KeysScreen />)

    fireEvent.change(screen.getByPlaceholderText(/search by label/i), {
      target: { value: 'ci' },
    })
    await waitFor(() =>
      expect(mockUseApiKeys).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ci' })),
    )

    chooseOption('Scope filter', 'client')
    await waitFor(() =>
      expect(mockUseApiKeys).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'client', offset: 0 }),
      ),
    )

    chooseOption('Environment filter', 'Development')
    await waitFor(() =>
      expect(mockUseApiKeys).toHaveBeenLastCalledWith(
        expect.objectContaining({ environmentId: 'e1', offset: 0 }),
      ),
    )
  })

  it('distinguishes an empty project from an empty filter result', () => {
    mockUseApiKeys.mockReturnValue({
      keys: [],
      total: 0,
      loading: false,
      error: null,
      refetch,
    })
    render(<KeysScreen />)
    expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search by label/i), {
      target: { value: 'nope' },
    })
    expect(screen.getByText('No keys match your filters.')).toBeInTheDocument()
  })

  it('shows the empty state when there are no keys', () => {
    mockUseApiKeys.mockReturnValue({ keys: [], total: 0, loading: false, error: null, refetch })
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

    /**
     * Admin scope is the default; the environment field stays visible but
     * dimmed and disabled, because admin keys span every environment.
     */
    expect(within(dialog).getByText('Environment')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Environment/ })).toBeDisabled()

    // Switch to client → environment select appears.
    fireEvent.click(within(dialog).getByRole('button', { name: 'client' }))
    expect(within(dialog).getByText('Environment')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByPlaceholderText('e.g. CI / e2e tests'), {
      target: { value: 'Test label' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /generate key/i }))

    await waitFor(() =>
      expect(mockKeysApi.create).toHaveBeenCalledWith('p1', {
        type: 'client',
        description: 'Test label',
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
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. CI / e2e tests'), {
      target: { value: 'Test label' },
    })
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

  /**
   * The modals open from arbitrary buttons rather than from a dedicated
   * trigger element, so focus coming back to the right place is worth pinning
   * down. It is the accessibility work this migration was meant to buy.
   */
  it('returns focus to the button that opened a modal when it closes', async () => {
    render(<KeysScreen />)
    const opener = screen.getByRole('button', { name: /issue key/i })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(opener)
  })
})
