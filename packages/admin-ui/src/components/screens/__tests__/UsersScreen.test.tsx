import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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
    get: vi.fn(),
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

/** usePermissions reads two contexts; mocking it directly keeps the tests flat. */
const perms = vi.hoisted(() => ({ canManage: true }))

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: perms.canManage ? 'admin' : 'viewer',
    canWrite: perms.canManage,
    canProjectAdmin: perms.canManage,
    canOwnerAct: false,
    canWriteEnv: () => perms.canManage,
  }),
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
import type { UserCounts, WorkspaceUser } from '../../../lib/api'
import type { Page } from '../../../lib/types'
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
    lastLoginAt: null,
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
    lastLoginAt: null,
    createdAt: '2026-02-01',
    projects: [],
  } as WorkspaceUser,
]

/**
 * Wraps rows in the paginated envelope. Bucket counts default to something
 * consistent with the rows so tests only state the ones they assert on.
 */
function page(rows: unknown[], counts: Partial<Record<string, number>> = {}) {
  return {
    data: {
      data: rows,
      total: rows.length,
      limit: 25,
      offset: 0,
      counts: {
        all: rows.length,
        active: 0,
        invited: 0,
        suspended: 0,
        system: 0,
        owners: 0,
        admins: 0,
        ...counts,
      },
    },
  } as unknown as AxiosResponse<Page<WorkspaceUser> & { counts: UserCounts }>
}

function renderScreen(initialEntry = '/users') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider>
        <ToastProvider>
          <UsersScreen />
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  perms.canManage = true
  vi.clearAllMocks()
  vi.mocked(usersApi.list).mockResolvedValue(page(mockUsers))
})

/**
 * React Aria names a row checkbox by composing its own label with the row
 * header cell, so the accessible name is "Select <name> <email> …" rather
 * than an exact string.
 */
function rowCheckbox(name: string) {
  return screen.getByRole('checkbox', { name: new RegExp(`^Select ${name}\\b`) })
}

/** Row actions live behind a "…" menu now: open it, then pick an item. */
async function openRowMenu(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }))
  return within(await screen.findByRole('menu'))
}

/**
 * HeroUI's Select is a button plus a listbox, not a native `<select>`, so a
 * value cannot be set with `fireEvent.change`.
 */
function chooseOption(selectLabel: string, optionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectLabel) }))
  fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('UsersScreen', () => {
  it('renders users after load', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('sends the search term to the server after the debounce', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } })

    /** Debounced, so the request lands once typing pauses -- not per keystroke. */
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'alice', offset: 0 }),
      ),
    )
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
    expect(rowCheckbox('Alice')).toBeInTheDocument()
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

  it('opens the drawer for the user named in the ?user= deep link', async () => {
    /** Fetched directly, so the linked user need not be on the current page. */
    /** The detail endpoint returns projects as objects, not names. */
    vi.mocked(usersApi.get).mockResolvedValue({
      data: { ...mockUsers[1], projects: [{ id: 'p1', name: 'Demo' }] },
    } as unknown as AxiosResponse<WorkspaceUser & { projects: { id: string; name: string }[] }>)
    renderScreen('/users?user=u2')
    await waitFor(() => expect(usersApi.get).toHaveBeenCalledWith('u2'))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /user detail: bob/i })).toBeInTheDocument(),
    )
  })

  it('ignores a ?user= deep link that matches nobody', async () => {
    vi.mocked(usersApi.get).mockRejectedValue(new Error('User not found'))
    renderScreen('/users?user=nope')
    await waitFor(() => screen.getByText('Alice'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    fireEvent.click(rowCheckbox(name))
  }

  /** Row hover actions also have a "Suspend" button; scope to the bulk bar. */
  function bulkBar() {
    return within(document.querySelector('.bulk-bar') as HTMLElement)
  }

  it('bulk role change patches every selected user and clears the selection', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    await selectUser('Alice')
    chooseOption('Change role', 'editor')
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { role: 'editor' }))
    await waitFor(() => expect(screen.queryByText(/selected/i)).not.toBeInTheDocument())
  })

  it('bulk add to project calls addToProject for every selected user', async () => {
    vi.mocked(usersApi.addToProject).mockResolvedValue({ data: {} } as AxiosResponse)
    await selectUser('Bob')
    chooseOption('Add to project', 'Demo')
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
    chooseOption('Change role', 'editor')
    await waitFor(() => expect(screen.getByText('Failed to change roles')).toBeInTheDocument())
    // Selection is kept so the user can retry
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
  })

  it('bulk reinstate patches suspended users back to active', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(page([{ ...mockUsers[0], status: 'suspended' }]))
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

  it('bulk resend reports partial success when some invites hit the cooldown', async () => {
    const carl = { ...mockUsers[1], id: 'u3', name: 'Carl', email: 'carl@a.com' }
    vi.mocked(usersApi.list).mockResolvedValue(page([mockUsers[1], carl]))
    vi.mocked(usersApi.resendInvite)
      .mockResolvedValueOnce({
        data: { emailed: true },
      } as AxiosResponse<Awaited<ReturnType<typeof usersApi.resendInvite>>['data']>)
      .mockRejectedValueOnce(
        new Error('This invite was sent moments ago. Wait a couple of minutes before resending.'),
      )
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click(rowCheckbox('Bob'))
    fireEvent.click(rowCheckbox('Carl'))
    fireEvent.click(bulkBar().getByRole('button', { name: 'Resend invites' }))
    await waitFor(() => expect(screen.getByText('Resent 1 of 2 invites')).toBeInTheDocument())
    expect(screen.getByText(/1 skipped: this invite was sent moments ago/i)).toBeInTheDocument()
    expect(usersApi.resendInvite).toHaveBeenCalledTimes(2)
  })

  it('bulk resend shows an error toast when every invite fails', async () => {
    vi.mocked(usersApi.resendInvite).mockRejectedValue(new Error('boom'))
    await selectUser('Bob')
    fireEvent.click(bulkBar().getByRole('button', { name: 'Resend invites' }))
    await waitFor(() => expect(screen.getByText('Failed to resend invite')).toBeInTheDocument())
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
    fireEvent.click((await openRowMenu('Bob')).getByRole('menuitem', { name: 'Resend invite' }))
    await waitFor(() => expect(usersApi.resendInvite).toHaveBeenCalledWith('u2'))
    await waitFor(() => expect(screen.getByText('Invite resent')).toBeInTheDocument())
  })

  it('shows the invite links dialog when email is off and the clipboard fails', async () => {
    /** jsdom has no navigator.clipboard, so the copy attempt throws. */
    vi.mocked(usersApi.resendInvite).mockResolvedValue({
      data: { emailed: false, email: 'bob@a.com', inviteUrl: 'https://x/invite/tok-1' },
    } as unknown as AxiosResponse<Awaited<ReturnType<typeof usersApi.resendInvite>>['data']>)
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click((await openRowMenu('Bob')).getByRole('menuitem', { name: 'Resend invite' }))
    await waitFor(() => expect(screen.getByText('Share invite links')).toBeInTheDocument())
    expect(screen.getByText('https://x/invite/tok-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy invite link for bob@a.com/i })).toBeVisible()
  })

  it('copies the link and skips the dialog when the clipboard works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.mocked(usersApi.resendInvite).mockResolvedValue({
      data: { emailed: false, email: 'bob@a.com', inviteUrl: 'https://x/invite/tok-2' },
    } as unknown as AxiosResponse<Awaited<ReturnType<typeof usersApi.resendInvite>>['data']>)
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click((await openRowMenu('Bob')).getByRole('menuitem', { name: 'Resend invite' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://x/invite/tok-2'))
    await waitFor(() => expect(screen.getByText(/copied to the clipboard/i)).toBeInTheDocument())
    expect(screen.queryByText('Share invite links')).not.toBeInTheDocument()
    /** Remove the mock so other tests keep exercising the no-clipboard path. */
    delete (navigator as unknown as Record<string, unknown>).clipboard
  })

  it('row Suspend action patches the user status', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<WorkspaceUser>)
    renderScreen()
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click((await openRowMenu('Alice')).getByRole('menuitem', { name: 'Suspend' }))
    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { status: 'suspended' }))
  })

  it('row Cancel invite action uses the guarded cancel endpoint, not delete', async () => {
    vi.mocked(usersApi.cancelInvite).mockResolvedValue({ data: {} } as unknown as AxiosResponse<
      Awaited<ReturnType<typeof usersApi.resendInvite>>['data']
    >)
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click((await openRowMenu('Bob')).getByRole('menuitem', { name: 'Cancel invite' }))
    await waitFor(() => expect(usersApi.cancelInvite).toHaveBeenCalledWith('u2'))
    expect(usersApi.delete).not.toHaveBeenCalled()
  })

  it('shows the server conflict message when the invite was already accepted', async () => {
    vi.mocked(usersApi.cancelInvite).mockRejectedValue(
      new Error('This invite was already accepted — the user is now active.'),
    )
    renderScreen()
    await waitFor(() => screen.getByText('Bob'))
    fireEvent.click((await openRowMenu('Bob')).getByRole('menuitem', { name: 'Cancel invite' }))
    await waitFor(() => expect(screen.getByText(/already accepted/i)).toBeInTheDocument())
  })

  it('disables role change and suspend when only owners are selected', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(page([{ ...mockUsers[0], role: 'owner' }]))
    await selectUser('Alice')
    expect(screen.getByRole('button', { name: /Change role/ })).toBeDisabled()
    expect(bulkBar().getByRole('button', { name: /^suspend$/i })).toBeDisabled()
  })

  it('shows the privileged access stat from the server counts', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(
      page([...mockUsers, { ...mockUsers[1], id: 'u3', name: 'Carol', role: 'owner' }], {
        owners: 1,
        admins: 1,
      }),
    )
    renderScreen()
    await waitFor(() => expect(screen.getByText(/Privileged access/)).toBeInTheDocument())
    const card = document.querySelector('.users-stat[data-tone="slate"]') as HTMLElement
    expect(within(card).getByText('2')).toBeInTheDocument()
    expect(within(card).getByText(/1 owner, 1 admin/)).toBeInTheDocument()
  })
})

describe('UsersScreen without member-management rights', () => {
  beforeEach(() => {
    perms.canManage = false
  })

  it('still lists members, because the list itself is not privileged', async () => {
    renderScreen()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('disables the invite button rather than pretending it is not there', async () => {
    renderScreen()
    await screen.findByText('Alice')
    expect(screen.getByRole('button', { name: /invite users/i })).toBeDisabled()
  })

  it('offers no row selection, so there is no bulk bar to reach', async () => {
    renderScreen()
    await screen.findByText('Alice')
    expect(screen.queryByRole('checkbox', { name: /select all/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /^select$/i })).not.toBeInTheDocument()
  })

  it('offers no per-row action menu', async () => {
    renderScreen()
    await screen.findByText('Alice')
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument()
  })
})

describe('UsersScreen loading states', () => {
  it('shows skeleton rows on the first load, not an empty table', () => {
    ;(usersApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByRole('status', { name: /loading users/i })).toBeInTheDocument()
    expect(screen.queryByText(/no users match/i)).not.toBeInTheDocument()
  })

  it('keeps the header and search box mounted while the first load runs', () => {
    ;(usersApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    renderScreen()
    /** Unmounting these would drop focus out of the search box on every fetch. */
    expect(screen.getByRole('heading', { name: /^users$/i })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search users/i })).toBeInTheDocument()
  })

  it('shows placeholders instead of zeroes in the stat tiles while counting', () => {
    ;(usersApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0)
  })
})
