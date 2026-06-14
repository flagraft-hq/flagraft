import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersScreen } from '../UsersScreen'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { ToastProvider } from '../../../contexts/ToastContext'

vi.mock('../UserDetailDrawer', () => ({
  UserDetailDrawer: ({ user, onClose }: { user: { name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label={`User detail: ${user.name}`}>
      <button onClick={onClose}>Close drawer</button>
    </div>
  ),
}))

vi.mock('../InviteModal', () => ({
  InviteModal: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" aria-label="invite-modal">
        InviteModal
      </div>
    ) : null,
}))

vi.mock('../../../lib/api', () => ({
  usersApi: {
    list: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    resetPassword: vi.fn(),
    invite: vi.fn(),
    addToProject: vi.fn(),
    removeFromProject: vi.fn(),
  },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 },
    projects: [{ id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 }],
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
    setActiveProject: vi.fn(),
  }),
}))

import type { AxiosResponse } from 'axios'
import type { WorkspaceUser } from '../../../lib/api'
import { usersApi } from '../../../lib/api'

const mockUsers = [
  {
    id: 'u1',
    name: 'Alice',
    email: 'alice@a.com',
    role: 'admin',
    status: 'active',
    twoFa: 'app',
    isSystem: false,
    initials: 'A',
    tone: 'teal',
    lastActiveAt: null,
    createdAt: '2026-01-01',
    projects: ['Demo'],
  } as WorkspaceUser,
  {
    id: 'u2',
    name: 'Bob',
    email: 'bob@a.com',
    role: 'viewer',
    status: 'invited',
    twoFa: 'none',
    isSystem: false,
    initials: 'B',
    tone: 'slate',
    lastActiveAt: null,
    createdAt: '2026-02-01',
    projects: [],
  } as WorkspaceUser,
]

function renderScreen() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <UsersScreen />
      </ToastProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersApi.list).mockResolvedValue({ data: mockUsers } as unknown as AxiosResponse<
    WorkspaceUser[]
  >)
})

describe('UsersScreen', () => {
  it('renders users after load', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('filters by search query', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('shows invite modal when Invite user is clicked', async () => {
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows bulk bar when a user is selected', async () => {
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
  })

  it('shows the server error message when users fail to load', async () => {
    vi.mocked(usersApi.list).mockRejectedValueOnce(new Error('Failed to fetch users'))
    renderScreen()
    await waitFor(() => expect(screen.getByText('Failed to fetch users')).toBeInTheDocument())
  })

  it('shows a fallback message when the error has no message', async () => {
    vi.mocked(usersApi.list).mockRejectedValueOnce('unexpected')
    renderScreen()
    await waitFor(() =>
      expect(screen.getAllByText('Failed to load users').length).toBeGreaterThan(0),
    )
  })

  it('renders a "Users" heading', async () => {
    renderScreen()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^users$/i })).toBeInTheDocument(),
    )
  })

  it('clicking a user row opens the UserDetailDrawer', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByRole('dialog', { name: /user detail: alice/i })).toBeInTheDocument()
  })

  it('clicking Clear selection X button clears the bulk bar', async () => {
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    // Select a user
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
    // Click the X
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
  })
})
