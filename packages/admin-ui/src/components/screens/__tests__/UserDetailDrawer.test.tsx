import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  twoFa: 'app',
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

  it('clicking Reset password calls usersApi.resetPassword and shows toast with temp password', async () => {
    mockUsersApi.resetPassword.mockResolvedValue({ data: { tempPassword: 'tmp-abc' } })
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    await waitFor(() => expect(mockUsersApi.resetPassword).toHaveBeenCalledWith('u1'))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({
        title: 'Password reset',
        msg: 'Temporary password: tmp-abc',
      }),
    )
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
