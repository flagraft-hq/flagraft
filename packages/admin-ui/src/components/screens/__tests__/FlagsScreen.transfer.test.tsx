import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { FlagsScreen } from '../FlagsScreen'

const permissions = {
  role: 'owner',
  canWrite: true,
  canProjectAdmin: true,
  canOwnerAct: true,
  canWriteEnv: () => true,
}

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}))

vi.mock('../../../hooks/useFlags', () => ({ useFlags: vi.fn() }))

const pushToast = vi.fn()
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ push: pushToast }) }))

vi.mock('../../../contexts/ProjectContext', () => ({ useProject: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../../../lib/api', () => ({ flagsApi: { toggle: vi.fn() } }))

vi.mock('../ImportFlagsModal', () => ({
  ImportFlagsModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Import flags dialog</div> : null,
}))

vi.mock('../ExportFlagsModal', () => ({
  ExportFlagsModal: ({ open, selectedKeys }: { open: boolean; selectedKeys: string[] }) =>
    open ? <div role="dialog">Export flags dialog: {selectedKeys.join(',') || 'all'}</div> : null,
}))

vi.mock('../CreateFlagModal', () => ({ CreateFlagModal: () => null }))
vi.mock('../FlagBulkActionBar', () => ({ FlagBulkActionBar: () => null }))

import { useFlags } from '../../../hooks/useFlags'
import { useProject } from '../../../contexts/ProjectContext'

const mockUseFlags = useFlags as ReturnType<typeof vi.fn>
const mockUseProject = useProject as ReturnType<typeof vi.fn>

const flags = [
  {
    key: 'flag-a',
    name: 'Flag A',
    description: '',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    state: { development: { on: true }, production: { on: false } },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  permissions.canProjectAdmin = true
  permissions.canWrite = true
  mockUseProject.mockReturnValue({
    activeProject: { id: 'proj-1', name: 'My Project', slug: 'my-project' },
    activeEnv: 'development',
    environments: [
      { id: 'e1', name: 'Development', slug: 'development', protected: false },
      { id: 'e2', name: 'Production', slug: 'production', protected: true },
    ],
    projects: [],
    loading: false,
    error: null,
    setActiveEnv: vi.fn(),
    refetchEnvironments: vi.fn(),
  })
  mockUseFlags.mockReturnValue({
    flags,
    total: 1,
    loading: false,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('FlagsScreen transfer controls', () => {
  it('opens the export dialog for the whole project when nothing is selected', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
    expect(screen.getByText(/export flags dialog: all/i)).toBeInTheDocument()
  })

  it('passes the selection to the export dialog', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('checkbox', { name: /^Select Flag A/ }))
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
    expect(screen.getByText(/export flags dialog: flag-a/i)).toBeInTheDocument()
  })

  it('opens the import dialog from Import', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))
    expect(screen.getByText('Import flags dialog')).toBeInTheDocument()
  })

  it('hides Import from a role that cannot administer the project', () => {
    permissions.canProjectAdmin = false
    render(<FlagsScreen />)

    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument()
    /** Export stays: reading every flag is already allowed. */
    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument()
  })

  it('offers no third transfer control', () => {
    render(<FlagsScreen />)
    expect(screen.queryByRole('button', { name: /another tool/i })).not.toBeInTheDocument()
  })
})
