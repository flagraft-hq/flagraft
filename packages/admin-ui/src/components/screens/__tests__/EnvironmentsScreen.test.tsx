import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnvironmentsScreen } from '../EnvironmentsScreen'

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

vi.mock('../../../hooks/useEnvironments', () => ({
  useEnvironments: vi.fn(),
}))

const mockToastPush = vi.fn()
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush }),
}))

vi.mock('../../../lib/api', () => ({
  apiBaseUrl: 'https://flags.example.com/api/v1',
  environmentsApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

import { useProject } from '../../../contexts/ProjectContext'
import { useEnvironments } from '../../../hooks/useEnvironments'
import { environmentsApi } from '../../../lib/api'

const mockUseProject = useProject as ReturnType<typeof vi.fn>
const mockUseEnvironments = useEnvironments as ReturnType<typeof vi.fn>
const mockEnvironmentsApi = environmentsApi as unknown as {
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const development = {
  id: 'e1',
  slug: 'development',
  name: 'Development',
  color: 'teal' as const,
  protected: false,
  flags: 2,
  defaultOn: 1,
  clientKeys: null,
}

const production = {
  id: 'e2',
  slug: 'production',
  name: 'Production',
  color: 'red' as const,
  protected: true,
  flags: 2,
  defaultOn: 2,
  clientKeys: 3,
}

const refetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseProject.mockReturnValue({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo' },
    environments: [],
    refetchEnvironments: vi.fn(),
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    setActiveProject: vi.fn(),
    loading: false,
    error: null,
  })
  mockUseEnvironments.mockReturnValue({
    environments: [development, production],
    loading: false,
    error: null,
    refetch,
  })
})

describe('EnvironmentsScreen', () => {
  it('renders a card per environment with its stats', () => {
    render(<EnvironmentsScreen />)
    expect(screen.getByText('Development')).toBeInTheDocument()
    expect(screen.getByText('/development')).toBeInTheDocument()
    expect(screen.getByText('protected')).toBeInTheDocument()
    /** Client keys are not exposed for every env, so a dash stands in. */
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  /**
   * The endpoint used to be a made-up `api.flagraft.io/v1/<slug>`. Every
   * install is self-hosted, so it has to come from the deployment -- and there
   * is one of it, not one per environment.
   */
  it('shows a single endpoint taken from the deployment, not a hardcoded domain', () => {
    render(<EnvironmentsScreen />)
    expect(screen.getAllByText('https://flags.example.com/api/v1')).toHaveLength(1)
    expect(screen.queryByText(/flagraft\.io/)).not.toBeInTheDocument()
  })

  it('hides delete on a protected environment', () => {
    render(<EnvironmentsScreen />)
    expect(screen.getAllByRole('button', { name: 'Edit environment' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Delete environment' })).toHaveLength(1)
  })

  it('creates an environment, defaulting the slug from the name', async () => {
    mockEnvironmentsApi.create.mockResolvedValue({ data: { id: 'e3' } })
    render(<EnvironmentsScreen />)

    fireEvent.click(screen.getByRole('button', { name: /new environment/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'QA Preview' } })
    expect(within(dialog).getByLabelText('Slug')).toHaveValue('qa-preview')

    fireEvent.click(within(dialog).getByRole('button', { name: /create environment/i }))
    await waitFor(() =>
      expect(mockEnvironmentsApi.create).toHaveBeenCalledWith('p1', {
        name: 'QA Preview',
        slug: 'qa-preview',
        protected: false,
      }),
    )
  })

  it('refuses a slug that is already taken', () => {
    render(<EnvironmentsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /new environment/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Production' } })

    expect(within(dialog).getByText(/already exists/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /create environment/i })).toBeDisabled()
    expect(mockEnvironmentsApi.create).not.toHaveBeenCalled()
  })

  it('deletes only after the confirmation dialog', async () => {
    mockEnvironmentsApi.delete.mockResolvedValue({})
    render(<EnvironmentsScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete environment' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete environment')).toBeInTheDocument()
    expect(mockEnvironmentsApi.delete).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockEnvironmentsApi.delete).toHaveBeenCalledWith('p1', 'e1'))
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('surfaces a load failure with a retry', () => {
    mockUseEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: 'boom',
      refetch,
    })
    render(<EnvironmentsScreen />)
    expect(screen.getByText('Failed to load environments')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalled()
  })
})
