import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlagsScreen } from '../FlagsScreen'

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

vi.mock('../../../hooks/useFlags', () => ({
  useFlags: vi.fn(),
}))

const pushToast = vi.fn()
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ push: pushToast }) }))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../../../lib/api', () => ({
  flagsApi: { toggle: vi.fn() },
}))

vi.mock('../FlagBulkActionBar', () => ({
  FlagBulkActionBar: ({ selectedKeys }: { selectedKeys: string[] }) =>
    selectedKeys.length > 0 ? (
      <div data-testid="bulk-bar">{selectedKeys.length} selected</div>
    ) : null,
}))

vi.mock('../CreateFlagModal', () => ({
  CreateFlagModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">New feature flag</div> : null,
}))

import { useFlags } from '../../../hooks/useFlags'
import { useProject } from '../../../contexts/ProjectContext'
import { flagsApi } from '../../../lib/api'

const mockUseFlags = useFlags as ReturnType<typeof vi.fn>
const mockUseProject = useProject as ReturnType<typeof vi.fn>

const defaultProject = { id: 'proj-1', name: 'My Project', slug: 'my-project', flagCount: 3 }

const defaultFlags = [
  {
    key: 'flag-a',
    name: 'Flag A',
    description: '',
    created: '2024-01-01',
    updated: '2024-01-02',
    state: {},
    author: 'user',
  },
]

const mockToggle = flagsApi.toggle as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
  mockUseFlags.mockReturnValue({
    flags: [],
    total: 0,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseProject.mockReturnValue({
    activeProject: defaultProject,
    activeEnv: 'development',
    environments: [],
    refetchEnvironments: vi.fn(),
    projects: [defaultProject],
    setActiveProject: vi.fn(),
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
  })
})

describe('FlagsScreen', () => {
  it('shows "No project selected" when activeProject is null', () => {
    mockUseProject.mockReturnValue({
      activeProject: null,
      activeEnv: 'development',
      environments: [],
      refetchEnvironments: vi.fn(),
      projects: [],
      setActiveProject: vi.fn(),
      setActiveEnv: vi.fn(),
      loading: false,
      error: null,
    })

    render(<FlagsScreen />)
    expect(screen.getByText('No project selected')).toBeInTheDocument()
  })

  it('shows loading indicator when loading is true', () => {
    mockUseFlags.mockReturnValue({
      flags: [],
      total: 0,
      loading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error message when error is not null', () => {
    mockUseFlags.mockReturnValue({
      flags: [],
      total: 0,
      loading: false,
      error: 'Failed to fetch flags',
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(screen.getByText('Failed to fetch flags')).toBeInTheDocument()
  })

  it('renders the flags list area when flags load', () => {
    mockUseFlags.mockReturnValue({
      flags: defaultFlags,
      total: defaultFlags.length,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(screen.getByRole('grid', { name: 'Feature flags' })).toBeInTheDocument()
  })

  it('has a "Feature flags" heading', () => {
    render(<FlagsScreen />)
    expect(screen.getByRole('heading', { name: 'Feature flags' })).toBeInTheDocument()
  })

  it('has a "New Flag" button', () => {
    render(<FlagsScreen />)
    expect(screen.getByRole('button', { name: /new flag/i })).toBeInTheDocument()
  })

  it('opens CreateFlagModal when New Flag is clicked', async () => {
    mockUseFlags.mockReturnValue({
      flags: defaultFlags,
      total: defaultFlags.length,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    const newFlagBtn = await screen.findByRole('button', { name: /new flag/i })
    fireEvent.click(newFlagBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New feature flag')).toBeInTheDocument()
  })

  it('shows the flag count', () => {
    mockUseFlags.mockReturnValue({
      flags: defaultFlags,
      total: defaultFlags.length,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(screen.getByText(/1 flag/i)).toBeInTheDocument()
  })
})

describe('FlagsScreen empty states', () => {
  it('shows no-data empty state when flags list is empty and no filters active', () => {
    mockUseFlags.mockReturnValue({
      flags: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(screen.getByText('No flags yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first feature flag to get started.')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('shows the no-results empty state when a filter is active and nothing matches', async () => {
    mockUseFlags.mockReturnValue({
      flags: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    /** With no filters yet, an empty project shows the no-data state. */
    expect(screen.getByText('No flags yet')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: 'nothing-matches-this' },
    })

    expect(screen.getByText('No flags match your filters')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('clear filters button resets the search box and drops the filtered empty state', () => {
    mockUseFlags.mockReturnValue({
      flags: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    const searchBox = screen.getByPlaceholderText(/search by name/i)
    fireEvent.change(searchBox, { target: { value: 'zzz' } })
    expect(screen.getByText('No flags match your filters')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(searchBox).toHaveValue('')
    expect(screen.queryByText('No flags match your filters')).not.toBeInTheDocument()
    expect(screen.getByText('No flags yet')).toBeInTheDocument()
  })
})

describe('FlagsScreen integration', () => {
  const multipleFlags = [
    {
      key: 'flag-alpha',
      name: 'Alpha Flag',
      description: 'First flag',
      created: '2024-01-01',
      updated: '2024-03-01',
      state: { development: { on: true } },
      author: 'user',
    },
    {
      key: 'flag-beta',
      name: 'Beta Flag',
      description: 'Second flag',
      created: '2024-02-01',
      updated: '2024-04-01',
      state: { development: { on: false } },
      author: 'user',
    },
    {
      key: 'flag-gamma',
      name: 'Gamma Flag',
      description: 'Third flag',
      created: '2024-03-01',
      updated: '2024-02-01',
      state: { development: { on: true } },
      author: 'user',
    },
  ]

  beforeEach(() => {
    mockUseFlags.mockReturnValue({
      flags: multipleFlags,
      total: multipleFlags.length,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders the pager with row-size control even when everything fits on one page', () => {
    render(<FlagsScreen />)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByText('1–3 of 3 flags')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'flags per page' })).toHaveValue('25')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('changing the page size refetches from the first page', async () => {
    render(<FlagsScreen />)
    fireEvent.change(screen.getByRole('combobox', { name: 'flags per page' }), {
      target: { value: '50' },
    })
    await waitFor(() =>
      expect(mockUseFlags).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 }),
      ),
    )
  })

  it('renders a row for each flag', () => {
    render(<FlagsScreen />)
    expect(screen.getByText('Alpha Flag')).toBeInTheDocument()
    expect(screen.getByText('Beta Flag')).toBeInTheDocument()
    expect(screen.getByText('Gamma Flag')).toBeInTheDocument()
    /** Three flags plus the header row. */
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('clicking the Flag column header sorts by name (ascending)', () => {
    render(<FlagsScreen />)
    const flagHead = screen.getByRole('columnheader', { name: /^flag$/i })
    expect(flagHead.getAttribute('aria-sort')).toBe('none')
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('ascending')
  })

  it('clicking an already-sorted column header toggles the direction', () => {
    render(<FlagsScreen />)
    const flagHead = screen.getByRole('columnheader', { name: /^flag$/i })
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('descending')
  })

  it('asks the API to re-sort rather than reordering the page itself', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('columnheader', { name: /^flag$/i }))
    expect(mockUseFlags).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortField: 'name', sortDir: 'asc' }),
    )
    /** The rows are still in the order the API handed them over. */
    const names = screen.getAllByRole('rowheader').map((c) => c.textContent)
    expect(names[0]).toContain('Alpha Flag')
    expect(names[1]).toContain('Beta Flag')
    expect(names[2]).toContain('Gamma Flag')
  })

  it('selecting a flag shows bulk action bar', () => {
    render(<FlagsScreen />)
    expect(screen.queryByTestId('bulk-bar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /^Select Alpha Flag/ }))
    expect(screen.getByTestId('bulk-bar')).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('flag count updates with filter', () => {
    render(<FlagsScreen />)
    expect(screen.getByText(/3 flags/i)).toBeInTheDocument()
  })

  it('clicking a flag row name navigates to the flag detail page', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByText('Alpha Flag'))
    expect(mockNavigate).toHaveBeenCalledWith('/flags/flag-alpha')
  })

  it('selecting multiple flags updates the bulk bar counter', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('checkbox', { name: /^Select Alpha Flag/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^Select Beta Flag/ }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('toggling a flag env calls flagsApi.toggle and triggers refetch', async () => {
    const mockRefetch = vi.fn()
    mockUseFlags.mockReturnValue({
      flags: multipleFlags,
      total: multipleFlags.length,
      loading: false,
      error: null,
      refetch: mockRefetch,
    })
    mockToggle.mockResolvedValue({ data: {} })
    render(<FlagsScreen />)
    /** Alpha is on in development, so clicking its switch turns it off. */
    fireEvent.click(screen.getByRole('switch', { name: 'flag-alpha in development' }))
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-alpha', 'development', false),
    )
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled())
  })

  it('a toggle error shows an inline error message', async () => {
    mockToggle.mockRejectedValue(new Error('Toggle failed'))
    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('switch', { name: 'flag-alpha in development' }))
    await waitFor(() => expect(screen.getByText('Toggle failed')).toBeInTheDocument())
  })
})

describe('FlagsScreen retry', () => {
  it('clicking Retry in the error state calls the refetch function', async () => {
    const mockRefetch = vi.fn()
    mockUseFlags.mockReturnValueOnce({
      flags: [],
      total: 0,
      loading: false,
      error: 'Network error',
      refetch: mockRefetch,
    })
    render(<FlagsScreen />)
    const retryButton = await screen.findByRole('button', { name: /try again/i })
    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})
