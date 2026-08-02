import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GlobalSearch } from '../GlobalSearch'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../../../lib/api', () => ({
  flagsApi: { list: vi.fn() },
  usersApi: { list: vi.fn() },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 2 },
    projects: [],
    activeEnv: 'development',
    environments: [],
    refetchEnvironments: vi.fn(),
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
    setActiveProject: vi.fn(),
  }),
}))

import type { AxiosResponse } from 'axios'
import type { WorkspaceUser } from '../../../lib/api'
import type { Flag, Page } from '../../../lib/types'
import { flagsApi, usersApi } from '../../../lib/api'

const flags = [
  { key: 'dark-mode', name: 'Dark Mode' },
  { key: 'new-billing', name: 'New Billing' },
]
const users = [{ id: 'u1', name: 'Alice Smith', email: 'alice@a.com' }]

function search(text: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
    target: { value: text },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(flagsApi.list).mockResolvedValue({
    data: { data: flags, total: flags.length, limit: 100, offset: 0 },
  } as unknown as AxiosResponse<Page<Flag>>)
  vi.mocked(usersApi.list).mockResolvedValue({ data: users } as unknown as AxiosResponse<
    WorkspaceUser[]
  >)
})

describe('GlobalSearch', () => {
  it('is a real editable input, not read-only', () => {
    render(<GlobalSearch />)
    const input = screen.getByRole('combobox', { name: 'Search' })
    expect(input).not.toHaveAttribute('readonly')
    search('dark')
    expect(input).toHaveValue('dark')
  })

  it('shows matching flags and users after the debounce', async () => {
    render(<GlobalSearch />)
    search('a')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('New Billing')).not.toBeInTheDocument()
  })

  it('debounces typing and throttles fetching: many keystrokes, one fetch', async () => {
    render(<GlobalSearch />)
    search('d')
    search('da')
    search('dar')
    search('dark')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    /** A follow-up query inside the throttle window reuses the cached lists. */
    search('billing')
    await waitFor(() => expect(screen.getByText('New Billing')).toBeInTheDocument())
    expect(flagsApi.list).toHaveBeenCalledTimes(1)
    expect(usersApi.list).toHaveBeenCalledTimes(1)
  })

  it('navigates to the flag on click', async () => {
    render(<GlobalSearch />)
    search('dark')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Dark Mode'))
    expect(mockNavigate).toHaveBeenCalledWith('/flags/dark-mode')
  })

  it('Enter opens the highlighted result, arrows move the highlight', async () => {
    render(<GlobalSearch />)
    const input = screen.getByRole('combobox', { name: 'Search' })
    search('a')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/users?user=u1')
  })

  it('Enter is ignored while the results are stale (typed past the debounce)', async () => {
    render(<GlobalSearch />)
    const input = screen.getByRole('combobox', { name: 'Search' })
    search('dark')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    /** New text typed; old hits still shown until the debounce fires. */
    search('billing')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockNavigate).not.toHaveBeenCalled()
    /** Once the debounce catches up, Enter works on the fresh results. */
    await waitFor(() => expect(screen.getByText('New Billing')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/flags/new-billing')
  })

  it('Escape closes the dropdown and clears the query', async () => {
    render(<GlobalSearch />)
    const input = screen.getByRole('combobox', { name: 'Search' })
    search('dark')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('Dark Mode')).not.toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('shows a no-matches message', async () => {
    render(<GlobalSearch />)
    search('zzz-nothing')
    await waitFor(() => expect(screen.getByText(/no matches for/i)).toBeInTheDocument())
  })

  it('still shows flags when the users request is forbidden', async () => {
    vi.mocked(usersApi.list).mockRejectedValue(new Error('Forbidden'))
    render(<GlobalSearch />)
    search('dark')
    await waitFor(() => expect(screen.getByText('Dark Mode')).toBeInTheDocument())
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument()
  })
})
