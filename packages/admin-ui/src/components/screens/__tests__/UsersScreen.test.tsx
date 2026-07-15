import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
    cancelInvite: vi.fn(),
    resetPassword: vi.fn(),
    resendInvite: vi.fn(),
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
import { usersApi } from '../../../lib/api'

const mockUsers = [
  {
    id: 'u1',
    name: 'Alice',
    email: 'alice@a.com',
    role: 'admin',
    status: 'active',
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

  it('keeps row select labels accessible-only (no visible "Select" text)', async () => {
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    /** Checkboxes expose their label via aria-label, not visible text. */
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Alice' })).toBeInTheDocument()
    expect(screen.queryByText('Select all')).not.toBeInTheDocument()
    expect(screen.queryByText('Select Alice')).not.toBeInTheDocument()
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

  async function selectUser(name: string) {
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${name}` }))
  }

  /** Row hover actions also have a "Suspend" button; scope to the bulk bar. */
  function bulkBar() {
    return within(document.querySelector('.bulk-bar') as HTMLElement)
  }

  it('bulk role change patches every selected user and clears the selection', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    await selectUser('Alice')
    fireEvent.change(screen.getByRole('combobox', { name: 'Change role' }), {
      target: { value: 'editor' },
    })
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { role: 'editor' }))
    await waitFor(() => expect(screen.queryByText(/selected/i)).not.toBeInTheDocument())
  })

  it('bulk add to project calls addToProject for every selected user', async () => {
    vi.mocked(usersApi.addToProject).mockResolvedValue({ data: {} } as AxiosResponse)
    await selectUser('Bob')
    fireEvent.change(screen.getByRole('combobox', { name: 'Add to project' }), {
      target: { value: 'p1' },
    })
    await waitFor(() => expect(usersApi.addToProject).toHaveBeenCalledWith('u2', 'p1'))
  })

  it('bulk suspend asks for confirmation, then patches status', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    await selectUser('Alice')
    fireEvent.click(bulkBar().getByRole('button', { name: /^suspend$/i }))
    expect(screen.getByText('Suspend this user?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Suspend user' }))
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { status: 'suspended' }))
  })

  it('shows an error toast when a bulk action fails', async () => {
    vi.mocked(usersApi.patch).mockRejectedValue(new Error('boom'))
    await selectUser('Alice')
    fireEvent.change(screen.getByRole('combobox', { name: 'Change role' }), {
      target: { value: 'editor' },
    })
    await waitFor(() => expect(screen.getByText('Failed to change roles')).toBeInTheDocument())
    // Selection is kept so the user can retry
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
  })

  it('bulk reinstate patches suspended users back to active', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({
      data: [{ ...mockUsers[0], status: 'suspended' }],
    } as unknown as AxiosResponse<WorkspaceUser[]>)
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    await selectUser('Alice')
    expect(bulkBar().getByRole('button', { name: /^suspend$/i })).toBeDisabled()
    fireEvent.click(bulkBar().getByRole('button', { name: 'Reinstate' }))
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { status: 'active' }))
  })

  it('bulk resend invites hits the resend endpoint for invited users only', async () => {
    vi.mocked(usersApi.resendInvite).mockResolvedValue({
      data: { emailed: true },
    } as AxiosResponse<Awaited<ReturnType<typeof usersApi.resendInvite>>['data']>)
    await selectUser('Bob')
    fireEvent.click(bulkBar().getByRole('button', { name: 'Resend invites' }))
    await waitFor(() => expect(usersApi.resendInvite).toHaveBeenCalledWith('u2'))
    expect(usersApi.resendInvite).toHaveBeenCalledTimes(1)
  })

  it('disables bulk resend when no invited user is selected', async () => {
    await selectUser('Alice')
    expect(bulkBar().getByRole('button', { name: 'Resend invites' })).toBeDisabled()
  })

  it('row Resend invite action hits the resend endpoint', async () => {
    vi.mocked(usersApi.resendInvite).mockResolvedValue({
      data: { emailed: true },
    } as AxiosResponse<Awaited<ReturnType<typeof usersApi.resendInvite>>['data']>)
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Resend invite' }))
    await waitFor(() => expect(usersApi.resendInvite).toHaveBeenCalledWith('u2'))
    await waitFor(() => expect(screen.getByText('Invite resent')).toBeInTheDocument())
  })

  it('row Suspend action patches the user status', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }))
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { status: 'suspended' }))
  })

  it('row Cancel invite action uses the guarded cancel endpoint, not delete', async () => {
    vi.mocked(usersApi.cancelInvite).mockResolvedValue({ data: {} } as AxiosResponse)
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invite' }))
    await waitFor(() => expect(usersApi.cancelInvite).toHaveBeenCalledWith('u2'))
    expect(usersApi.delete).not.toHaveBeenCalled()
  })

  it('shows the server conflict message when the invite was already accepted', async () => {
    vi.mocked(usersApi.cancelInvite).mockRejectedValue(
      new Error('This invite was already accepted — the user is now active.'),
    )
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invite' }))
    await waitFor(() => expect(screen.getByText(/already accepted/i)).toBeInTheDocument())
  })

  it('disables role change and suspend when only owners are selected', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({
      data: [{ ...mockUsers[0], role: 'owner' }],
    } as unknown as AxiosResponse<WorkspaceUser[]>)
    await selectUser('Alice')
    expect(screen.getByRole('combobox', { name: 'Change role' })).toBeDisabled()
    expect(bulkBar().getByRole('button', { name: /^suspend$/i })).toBeDisabled()
  })
})
