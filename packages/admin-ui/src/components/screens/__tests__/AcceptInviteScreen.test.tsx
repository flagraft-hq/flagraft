import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AcceptInviteScreen } from '../AcceptInviteScreen'

const mockAcceptInvite = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ acceptInvite: mockAcceptInvite }),
}))

vi.mock('../../../lib/api', () => ({
  inviteApi: { get: vi.fn(), accept: vi.fn() },
}))

import { inviteApi } from '../../../lib/api'

function renderAt(token = 'tok-abc') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<AcceptInviteScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('AcceptInviteScreen', () => {
  it('shows the set-password form for a valid invite', async () => {
    vi.mocked(inviteApi.get).mockResolvedValue({
      data: { email: 'jo@co.com', name: 'Jo' },
    } as unknown as Awaited<ReturnType<typeof inviteApi.get>>)
    renderAt()
    await waitFor(() => expect(screen.getByText('Set your password')).toBeInTheDocument())
    expect(screen.getByText('jo@co.com')).toBeInTheDocument()
  })

  it('shows an expired state for an invalid link', async () => {
    vi.mocked(inviteApi.get).mockRejectedValue(
      new Error('This invite link is invalid or has expired'),
    )
    renderAt()
    await waitFor(() => expect(screen.getByText(/invite link expired/i)).toBeInTheDocument())
  })

  it('blocks activation until passwords match and meet the minimum', async () => {
    vi.mocked(inviteApi.get).mockResolvedValue({
      data: { email: 'jo@co.com', name: 'Jo' },
    } as unknown as Awaited<ReturnType<typeof inviteApi.get>>)
    renderAt()
    await waitFor(() => screen.getByText('Set your password'))
    const btn = screen.getByRole('button', { name: /activate account/i })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'mismatch' } })
    expect(screen.getByText(/don't match/i)).toBeInTheDocument()
    expect(btn).toBeDisabled()
  })

  it('activates and navigates to /flags on success', async () => {
    vi.mocked(inviteApi.get).mockResolvedValue({
      data: { email: 'jo@co.com', name: 'Jo' },
    } as unknown as Awaited<ReturnType<typeof inviteApi.get>>)
    mockAcceptInvite.mockResolvedValue(undefined)
    renderAt('tok-xyz')
    await waitFor(() => screen.getByText('Set your password'))
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'longenough1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /activate account/i }))
    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith('tok-xyz', 'longenough1'))
    expect(mockNavigate).toHaveBeenCalledWith('/flags', { replace: true })
  })
})
