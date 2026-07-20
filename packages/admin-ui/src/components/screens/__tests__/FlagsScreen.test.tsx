import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlagsScreen } from '../FlagsScreen'

vi.mock('../../../hooks/useFlags', () => ({
  useFlags: vi.fn(),
}))

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

vi.mock('../FlagRow', () => ({
  FlagRow: ({
    flag,
    onSelect,
    onClick,
    onToggle,
  }: {
    flag: { key: string; name: string }
    onSelect: (key: string, selected: boolean) => void
    onClick: (key: string) => void
    onToggle: (key: string, env: string, enabled: boolean) => void
  }) => (
    <div data-testid={`flag-row-${flag.key}`} onClick={() => onSelect(flag.key, true)}>
      {flag.name}
      <button data-testid={`nav-${flag.key}`} onClick={() => onClick(flag.key)}>
        Open
      </button>
      <button
        data-testid={`toggle-${flag.key}`}
        onClick={() => onToggle(flag.key, 'development', true)}
      >
        Toggle
      </button>
    </div>
  ),
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
    tags: [],
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
  mockUseFlags.mockReturnValue({ flags: [], loading: false, error: null, refetch: vi.fn() })
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
    mockUseFlags.mockReturnValue({ flags: [], loading: true, error: null, refetch: vi.fn() })

    render(<FlagsScreen />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error message when error is not null', () => {
    mockUseFlags.mockReturnValue({
      flags: [],
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
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    expect(document.querySelector('.flags-list')).toBeInTheDocument()
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
    mockUseFlags.mockReturnValue({ flags: [], loading: false, error: null, refetch: vi.fn() })

    render(<FlagsScreen />)
    expect(screen.getByText('No flags yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first feature flag to get started.')).toBeInTheDocument()
    expect(document.querySelector('.flags-list')).not.toBeInTheDocument()
  })

  it('shows no-results empty state when filters produce empty list', () => {
    /** All flags are "on" so clicking the "Off" filter yields zero results */
    const allOnFlags = [
      {
        key: 'flag-x',
        name: 'Flag X',
        description: '',
        tags: [],
        created: '2024-01-01',
        updated: '2024-01-02',
        state: { development: { on: true } },
        author: 'user',
      },
    ]
    mockUseFlags.mockReturnValue({
      flags: allOnFlags,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /off everywhere/i }))

    expect(screen.getByText('No flags match your filters')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument()
    expect(document.querySelector('.flags-list')).not.toBeInTheDocument()
  })

  it('clear filters button resets search, tags, and state filter and shows the list again', () => {
    /** Same all-on setup as above */
    const allOnFlags = [
      {
        key: 'flag-x',
        name: 'Flag X',
        description: '',
        tags: [],
        created: '2024-01-01',
        updated: '2024-01-02',
        state: { development: { on: true } },
        author: 'user',
      },
    ]
    mockUseFlags.mockReturnValue({
      flags: allOnFlags,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<FlagsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /off everywhere/i }))

    expect(screen.getByText('No flags match your filters')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(screen.queryByText('No flags match your filters')).not.toBeInTheDocument()
    expect(document.querySelector('.flags-list')).toBeInTheDocument()
  })
})

describe('FlagsScreen integration', () => {
  const multipleFlags = [
    {
      key: 'flag-alpha',
      name: 'Alpha Flag',
      description: 'First flag',
      tags: ['core'],
      created: '2024-01-01',
      updated: '2024-03-01',
      state: { development: { on: true } },
      author: 'user',
    },
    {
      key: 'flag-beta',
      name: 'Beta Flag',
      description: 'Second flag',
      tags: ['experimental'],
      created: '2024-02-01',
      updated: '2024-04-01',
      state: { development: { on: false } },
      author: 'user',
    },
    {
      key: 'flag-gamma',
      name: 'Gamma Flag',
      description: 'Third flag',
      tags: ['core', 'experimental'],
      created: '2024-03-01',
      updated: '2024-02-01',
      state: { development: { on: true } },
      author: 'user',
    },
  ]

  beforeEach(() => {
    mockUseFlags.mockReturnValue({
      flags: multipleFlags,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders FlagRow for each flag', () => {
    render(<FlagsScreen />)
    expect(screen.getByTestId('flag-row-flag-alpha')).toBeInTheDocument()
    expect(screen.getByTestId('flag-row-flag-beta')).toBeInTheDocument()
    expect(screen.getByTestId('flag-row-flag-gamma')).toBeInTheDocument()
    expect(screen.getByText('Alpha Flag')).toBeInTheDocument()
    expect(screen.getByText('Beta Flag')).toBeInTheDocument()
    expect(screen.getByText('Gamma Flag')).toBeInTheDocument()
  })

  it('clicking the Flag column header sorts by name (ascending)', () => {
    render(<FlagsScreen />)
    const flagHead = screen.getByRole('button', { name: /^flag$/i })
    expect(flagHead.getAttribute('aria-sort')).toBe('none')
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('ascending')
  })

  it('clicking an already-sorted column header toggles the direction', () => {
    render(<FlagsScreen />)
    const flagHead = screen.getByRole('button', { name: /^flag$/i })
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(flagHead)
    expect(flagHead.getAttribute('aria-sort')).toBe('descending')
  })

  it('selecting a flag shows bulk action bar', () => {
    render(<FlagsScreen />)
    expect(screen.queryByTestId('bulk-bar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('flag-row-flag-alpha'))
    expect(screen.getByTestId('bulk-bar')).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('flag count updates with filter', () => {
    render(<FlagsScreen />)
    expect(screen.getByText(/3 flags/i)).toBeInTheDocument()
  })

  it('clicking a flag row name navigates to the flag detail page', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByTestId('nav-flag-alpha'))
    expect(mockNavigate).toHaveBeenCalledWith('/flags/flag-alpha')
  })

  it('selecting multiple flags updates the bulk bar counter', () => {
    render(<FlagsScreen />)
    fireEvent.click(screen.getByTestId('flag-row-flag-alpha'))
    fireEvent.click(screen.getByTestId('flag-row-flag-beta'))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('toggling a flag env calls flagsApi.toggle and triggers refetch', async () => {
    const mockRefetch = vi.fn()
    mockUseFlags.mockReturnValue({
      flags: multipleFlags,
      loading: false,
      error: null,
      refetch: mockRefetch,
    })
    mockToggle.mockResolvedValue({})
    render(<FlagsScreen />)
    fireEvent.click(screen.getByTestId('toggle-flag-alpha'))
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-alpha', 'development', true),
    )
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled())
  })

  it('a toggle error shows an inline error message', async () => {
    mockToggle.mockRejectedValue(new Error('Toggle failed'))
    render(<FlagsScreen />)
    fireEvent.click(screen.getByTestId('toggle-flag-alpha'))
    await waitFor(() => expect(screen.getByText('Toggle failed')).toBeInTheDocument())
  })
})

describe('FlagsScreen retry', () => {
  it('clicking Retry in the error state calls the refetch function', async () => {
    const mockRefetch = vi.fn()
    mockUseFlags.mockReturnValueOnce({
      flags: [],
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
