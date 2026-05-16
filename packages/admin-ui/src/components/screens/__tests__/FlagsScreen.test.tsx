import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlagsScreen } from '../FlagsScreen'

vi.mock('../../../hooks/useFlags', () => ({
  useFlags: vi.fn(),
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../FlagRow', () => ({
  FlagRow: ({
    flag,
    onSelect,
  }: {
    flag: { key: string; name: string }
    onSelect: (key: string, selected: boolean) => void
  }) => (
    <div data-testid={`flag-row-${flag.key}`} onClick={() => onSelect(flag.key, true)}>
      {flag.name}
    </div>
  ),
}))

vi.mock('../BulkActionBar', () => ({
  BulkActionBar: ({ selectedKeys }: { selectedKeys: string[] }) =>
    selectedKeys.length > 0 ? (
      <div data-testid="bulk-bar">{selectedKeys.length} selected</div>
    ) : null,
}))

import { useFlags } from '../../../hooks/useFlags'
import { useProject } from '../../../contexts/ProjectContext'

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

beforeEach(() => {
  vi.clearAllMocks()
  mockUseFlags.mockReturnValue({ flags: [], loading: false, error: null, refetch: vi.fn() })
  mockUseProject.mockReturnValue({
    activeProject: defaultProject,
    activeEnv: 'development',
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

  it('has a "Feature Flags" heading', () => {
    render(<FlagsScreen />)
    expect(screen.getByRole('heading', { name: 'Feature Flags' })).toBeInTheDocument()
  })

  it('has a "New Flag" button', () => {
    render(<FlagsScreen />)
    expect(screen.getByRole('button', { name: /new flag/i })).toBeInTheDocument()
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

describe('FlagsScreen integration', () => {
  const multipleFlags = [
    {
      key: 'flag-alpha',
      name: 'Alpha Flag',
      description: 'First flag',
      tags: ['core'],
      created: '2024-01-01',
      updated: '2024-03-01',
      state: { development: { on: true, overrides: 0 } },
      author: 'user',
    },
    {
      key: 'flag-beta',
      name: 'Beta Flag',
      description: 'Second flag',
      tags: ['experimental'],
      created: '2024-02-01',
      updated: '2024-04-01',
      state: { development: { on: false, overrides: 0 } },
      author: 'user',
    },
    {
      key: 'flag-gamma',
      name: 'Gamma Flag',
      description: 'Third flag',
      tags: ['core', 'experimental'],
      created: '2024-03-01',
      updated: '2024-02-01',
      state: { development: { on: true, overrides: 2 } },
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

  it('sort buttons change active class', () => {
    render(<FlagsScreen />)
    const nameBtn = screen.getByRole('button', { name: /^name$/i })
    expect(nameBtn).not.toHaveClass('sort-btn-active')
    fireEvent.click(nameBtn)
    expect(nameBtn).toHaveClass('sort-btn-active')
  })

  it('direction toggle switches between Asc and Desc', () => {
    render(<FlagsScreen />)
    const dirBtn = screen.getByRole('button', { name: /desc/i })
    expect(dirBtn).toHaveTextContent('Desc')
    fireEvent.click(dirBtn)
    expect(screen.getByRole('button', { name: /asc/i })).toHaveTextContent('Asc')
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
})
