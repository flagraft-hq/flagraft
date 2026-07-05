import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InviteModal } from '../InviteModal'

vi.mock('../../../lib/api', () => ({
  usersApi: { invite: vi.fn() },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projects: [
      { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 2 },
      { id: 'p2', name: 'Beta', slug: 'beta', flagCount: 1 },
    ],
    activeProject: { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 2 },
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

import { usersApi } from '../../../lib/api'

beforeEach(() => {
  vi.clearAllMocks()
})

/** Renders the modal in open or closed state. */
function renderModal(open = true, onClose = vi.fn(), onInvited = vi.fn()) {
  return render(<InviteModal open={open} onClose={onClose} onInvited={onInvited} />)
}

describe('InviteModal', () => {
  it('renders email textarea, role select, and project chips when open', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.getElementById('invite-emails')).toBeInTheDocument()
    expect(document.getElementById('invite-role')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /alpha/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /beta/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderModal(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Send button is disabled when emails textarea is empty', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /send.*invites/i })
    expect(btn).toBeDisabled()
  })

  it('Send button is disabled when no project is selected', () => {
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'x@a.com' },
    })
    // No project chip clicked yet — button stays disabled
    const btn = screen.getByRole('button', { name: /send.*invite/i })
    expect(btn).toBeDisabled()
  })

  it('Send button is enabled when email and project are filled', () => {
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'x@a.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    const btn = screen.getByRole('button', { name: /send.*invite/i })
    expect(btn).not.toBeDisabled()
  })

  it('clicking a project chip toggles aria-pressed', () => {
    renderModal()
    const chip = screen.getByRole('button', { name: /alpha/i })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the correct parsed email count in the hint text', () => {
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'a@a.com, b@a.com' },
    })
    expect(screen.getByText(/2 recipients/i)).toBeInTheDocument()
  })

  it('flags an invalid email and blocks sending until it is fixed', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'good@a.com, not-an-email' },
    })
    expect(screen.getByText(/1 invalid/i)).toBeInTheDocument()
    expect(screen.getByText('not-an-email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send.*invite/i })).toBeDisabled()
  })

  it('de-duplicates and only sends valid emails', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue({
      data: [{ email: 'a@a.com', tempPassword: 't', emailed: true }],
    } as unknown as Awaited<ReturnType<typeof usersApi.invite>>)
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'a@a.com, A@a.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(usersApi.invite).toHaveBeenCalledWith(['a@a.com'], 'editor', ['p1']))
  })

  it('calls usersApi.invite with correct args on submit', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue({
      data: [{ email: 'x@a.com', tempPassword: 'tmp-123' }],
    } as unknown as Awaited<ReturnType<typeof usersApi.invite>>)
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'x@a.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(usersApi.invite).toHaveBeenCalledWith(['x@a.com'], 'editor', ['p1']))
  })

  const inviteResult = (over: Partial<{ emailed: boolean }> = {}) => ({
    data: [
      {
        id: 'u1',
        email: 'x@a.com',
        inviteUrl: 'http://localhost/invite/tok-123',
        expiresAt: '2026-07-02T00:00:00.000Z',
        emailed: true,
        ...over,
      },
    ],
  })

  it('shows the emailed badge in the results phase when emailed is true', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(
      inviteResult({ emailed: true }) as unknown as Awaited<ReturnType<typeof usersApi.invite>>,
    )
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, { target: { value: 'x@a.com' } })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(screen.getByText(/1 invite sent/i)).toBeInTheDocument())
    expect(screen.getByText('Emailed')).toBeInTheDocument()
  })

  it('shows the manual-share link in the results phase when emailed is false', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(
      inviteResult({ emailed: false }) as unknown as Awaited<ReturnType<typeof usersApi.invite>>,
    )
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, { target: { value: 'x@a.com' } })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(screen.getByText('Share manually')).toBeInTheDocument())
    expect(screen.getByText('http://localhost/invite/tok-123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy invite link/i })).toBeInTheDocument()
  })

  it('calls onInvited after successful invite', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(
      inviteResult() as unknown as Awaited<ReturnType<typeof usersApi.invite>>,
    )
    const mockOnInvited = vi.fn()
    render(<InviteModal open onClose={vi.fn()} onInvited={mockOnInvited} />)
    fireEvent.change(document.getElementById('invite-emails')!, { target: { value: 'x@a.com' } })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(mockOnInvited).toHaveBeenCalled())
  })

  it('closes when Done is clicked in the results phase', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(
      inviteResult() as unknown as Awaited<ReturnType<typeof usersApi.invite>>,
    )
    const mockOnClose = vi.fn()
    render(<InviteModal open onClose={mockOnClose} />)
    fireEvent.change(document.getElementById('invite-emails')!, { target: { value: 'x@a.com' } })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows error toast on invite failure', async () => {
    vi.mocked(usersApi.invite).mockRejectedValueOnce(new Error('Network error'))
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'x@a.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send.*invite/i }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({
        title: 'Failed to send invites',
        msg: 'Network error',
        variant: 'error',
      }),
    )
  })

  it('Send button label shows count: "Send 2 invites" for 2 emails', () => {
    renderModal()
    fireEvent.change(document.getElementById('invite-emails')!, {
      target: { value: 'a@a.com, b@a.com' },
    })
    expect(screen.getByRole('button', { name: /send 2 invites/i })).toBeInTheDocument()
  })
})
