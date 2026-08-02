import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { SettingsMembers } from '../SettingsMembers'

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api')
  return {
    ...actual,
    usersApi: { list: vi.fn(), patch: vi.fn() },
  }
})

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Me', role: 'owner' } }),
}))

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 } }),
}))

const pushToast = vi.fn()
vi.mock('../../../../hooks/useToast', () => ({ useToast: () => ({ push: pushToast }) }))

vi.mock('../../InviteModal', () => ({
  InviteModal: ({ open }: { open: boolean }) => (open ? <div role="dialog">invite</div> : null),
}))

import { usersApi, type WorkspaceUser } from '../../../../lib/api'

const members = [
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
  },
] as WorkspaceUser[]

function page(rows: WorkspaceUser[], total = rows.length) {
  return {
    data: {
      data: rows,
      total,
      limit: 25,
      offset: 0,
      counts: {
        all: total,
        active: 0,
        invited: 0,
        suspended: 0,
        system: 0,
        owners: 0,
        admins: 0,
      },
    },
  } as unknown as AxiosResponse<never>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersApi.list).mockResolvedValue(page(members))
})

describe('SettingsMembers', () => {
  it('scopes the request to the active project', async () => {
    render(<SettingsMembers />)
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' })),
    )
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('sends the search term to the server after the debounce', async () => {
    render(<SettingsMembers />)
    await screen.findByText('Alice')
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: 'ali' },
    })
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'ali', projectId: 'p1' }),
      ),
    )
  })

  it('sends the selected role and omits it for "All roles"', async () => {
    render(<SettingsMembers />)
    await screen.findByText('Alice')

    fireEvent.change(screen.getByRole('combobox', { name: 'Role filter' }), {
      target: { value: 'editor' },
    })
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'editor' })),
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Role filter' }), {
      target: { value: 'all' },
    })
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ role: undefined })),
    )
  })

  it('renders the pager using the server total', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(page(members, 60))
    render(<SettingsMembers />)
    await screen.findByText('Alice')
    expect(screen.getByText('1–25 of 60 members')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument()
  })

  it('requests the next page and returns to page 1 when a filter changes', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(page(members, 60))
    render(<SettingsMembers />)
    await screen.findByText('Alice')

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25 })),
    )

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'z' } })
    await waitFor(() =>
      expect(usersApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'z', offset: 0 }),
      ),
    )
  })

  it('shows an empty message when no member matches', async () => {
    vi.mocked(usersApi.list).mockResolvedValue(page([], 0))
    render(<SettingsMembers />)
    expect(await screen.findByText('No members match.')).toBeInTheDocument()
  })

  it('refetches after a role change instead of patching the row locally', async () => {
    vi.mocked(usersApi.patch).mockResolvedValue({ data: {} } as AxiosResponse<never>)
    render(<SettingsMembers />)
    await screen.findByText('Alice')
    const callsBefore = vi.mocked(usersApi.list).mock.calls.length

    fireEvent.change(screen.getByRole('combobox', { name: 'Role for Alice' }), {
      target: { value: 'editor' },
    })

    await waitFor(() => expect(usersApi.patch).toHaveBeenCalledWith('u1', { role: 'editor' }))
    await waitFor(() =>
      expect(vi.mocked(usersApi.list).mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })

  it('surfaces a load failure with a retry', async () => {
    vi.mocked(usersApi.list).mockRejectedValue(new Error('boom'))
    render(<SettingsMembers />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
