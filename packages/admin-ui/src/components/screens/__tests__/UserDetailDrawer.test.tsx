import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserDetailDrawer } from '../UserDetailDrawer'
import type { WorkspaceUser } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  usersApi: {
    resetPassword: vi.fn(),
    patch: vi.fn(),
    addToProject: vi.fn(),
    removeFromProject: vi.fn(),
  },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projects: [{ id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 }],
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 },
    activeEnv: 'development',
    environments: [],
    refetchEnvironments: vi.fn(),
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
    setActiveProject: vi.fn(),
  }),
}))

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), toasts: [] }),
}))

/**
 * Capture the handlers object passed to useKeyboardShortcuts so tests
 * can invoke them directly without relying on DOM keyboard events.
 */
let capturedHandlers: Record<string, () => void> = {}

vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (handlers: Record<string, () => void>) => {
    capturedHandlers = handlers
  },
}))

import { usersApi } from '../../../lib/api'

const mockUsersApi = usersApi as unknown as {
  resetPassword: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  addToProject: ReturnType<typeof vi.fn>
  removeFromProject: ReturnType<typeof vi.fn>
}

const activeUser: WorkspaceUser = {
  id: 'u1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  role: 'admin',
  status: 'active',
  isSystem: false,
  initials: 'AS',
  tone: 'teal',
  lastActiveAt: '2026-05-01',
  createdAt: '2026-01-01',
  projects: ['Demo'],
}

const suspendedUser: WorkspaceUser = {
  ...activeUser,
  status: 'suspended',
}

function renderDrawer(user: WorkspaceUser = activeUser, onClose = vi.fn(), onUpdated = vi.fn()) {
  return render(<UserDetailDrawer user={user} onClose={onClose} onUpdated={onUpdated} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedHandlers = {}
})

describe('UserDetailDrawer', () => {
  it('renders user name, email, role badge, and status badge', () => {
    renderDrawer()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows "Reset password" button', () => {
    renderDrawer()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('clicking Reset password opens the reset password modal', () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    expect(screen.getByLabelText(/new password/i, { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i, { selector: 'input' })).toBeInTheDocument()
  })

  it('submitting the reset modal calls usersApi.resetPassword with the chosen password', async () => {
    mockUsersApi.resetPassword.mockResolvedValue({})
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'brand-new-pass' },
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'brand-new-pass' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^reset password$/i })[1])
    await waitFor(() =>
      expect(mockUsersApi.resetPassword).toHaveBeenCalledWith('u1', 'brand-new-pass'),
    )
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Password reset' }),
      ),
    )
  })

  it('Escape closes the reset modal first, not the drawer', () => {
    const mockOnClose = vi.fn()
    renderDrawer(activeUser, mockOnClose)
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    act(() => capturedHandlers.Escape?.())
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/new password/i, { selector: 'input' })).not.toBeInTheDocument()
  })

  it('shows "Suspend" button for active user', () => {
    renderDrawer()
    expect(screen.getByRole('button', { name: /suspend/i })).toBeInTheDocument()
  })

  it('clicking Suspend calls usersApi.patch with status=suspended and shows "User suspended" toast', async () => {
    mockUsersApi.patch.mockResolvedValue({ data: { ...activeUser, status: 'suspended' } })
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /suspend/i }))
    await waitFor(() =>
      expect(mockUsersApi.patch).toHaveBeenCalledWith('u1', { status: 'suspended' }),
    )
    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith({ title: 'User suspended' }))
  })

  it('calls onUpdated after suspend with updated user', async () => {
    const updatedUser = { ...activeUser, status: 'suspended' as const }
    mockUsersApi.patch.mockResolvedValue({ data: updatedUser })
    const mockOnUpdated = vi.fn()
    renderDrawer(activeUser, vi.fn(), mockOnUpdated)
    fireEvent.click(screen.getByRole('button', { name: /suspend/i }))
    await waitFor(() => expect(mockOnUpdated).toHaveBeenCalledWith(updatedUser))
  })

  it('removing a project calls onUpdated with the project dropped', async () => {
    mockUsersApi.removeFromProject.mockResolvedValue({})
    const mockOnUpdated = vi.fn()
    renderDrawer(activeUser, vi.fn(), mockOnUpdated)
    fireEvent.click(screen.getByRole('button', { name: /remove from demo/i }))
    await waitFor(() => expect(mockUsersApi.removeFromProject).toHaveBeenCalledWith('u1', 'p1'))
    await waitFor(() =>
      expect(mockOnUpdated).toHaveBeenCalledWith(expect.objectContaining({ projects: [] })),
    )
  })

  it('adding a project calls onUpdated with the project appended', async () => {
    mockUsersApi.addToProject.mockResolvedValue({})
    const mockOnUpdated = vi.fn()
    const userNoProjects = { ...activeUser, projects: [] }
    renderDrawer(userNoProjects, vi.fn(), mockOnUpdated)
    fireEvent.click(screen.getByRole('button', { name: /add to project/i }))
    fireEvent.change(screen.getByLabelText(/choose project/i), { target: { value: 'p1' } })
    await waitFor(() => expect(mockUsersApi.addToProject).toHaveBeenCalledWith('u1', 'p1'))
    await waitFor(() =>
      expect(mockOnUpdated).toHaveBeenCalledWith(expect.objectContaining({ projects: ['Demo'] })),
    )
  })

  it('shows "Reinstate" button for suspended user', () => {
    renderDrawer(suspendedUser)
    expect(screen.getByRole('button', { name: /reinstate/i })).toBeInTheDocument()
  })

  it('clicking Reinstate calls usersApi.patch with status=active and shows "User reinstated" toast', async () => {
    mockUsersApi.patch.mockResolvedValue({ data: { ...suspendedUser, status: 'active' } })
    renderDrawer(suspendedUser)
    fireEvent.click(screen.getByRole('button', { name: /reinstate/i }))
    await waitFor(() => expect(mockUsersApi.patch).toHaveBeenCalledWith('u1', { status: 'active' }))
    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith({ title: 'User reinstated' }))
  })

  it('pressing Escape calls onClose', () => {
    const mockOnClose = vi.fn()
    renderDrawer(activeUser, mockOnClose)
    capturedHandlers.Escape?.()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('clicking the backdrop calls onClose', () => {
    const mockOnClose = vi.fn()
    const { container } = renderDrawer(activeUser, mockOnClose)
    const backdrop = container.querySelector('.drawer-backdrop')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('clicking inside the drawer does not call onClose', async () => {
    const mockOnClose = vi.fn()
    renderDrawer(activeUser, mockOnClose)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})
