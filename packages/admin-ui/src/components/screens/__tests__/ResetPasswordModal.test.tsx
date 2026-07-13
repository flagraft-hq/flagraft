import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResetPasswordModal } from '../ResetPasswordModal'

vi.mock('../../../lib/api', () => ({
  usersApi: {
    resetPassword: vi.fn(),
  },
}))

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), toasts: [] }),
}))

import { usersApi } from '../../../lib/api'

const mockResetPassword = usersApi.resetPassword as unknown as ReturnType<typeof vi.fn>

const user = { id: 'u1', email: 'alice@example.com' }

function renderModal(onClose = vi.fn()) {
  render(<ResetPasswordModal user={user} open onClose={onClose} />)
  return onClose
}

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
    target: { value: confirm },
  })
}

function submitButton() {
  return screen.getByRole('button', { name: /^reset password$/i })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetPasswordModal', () => {
  it('renders nothing when closed', () => {
    render(<ResetPasswordModal user={user} open={false} onClose={vi.fn()} />)
    expect(screen.queryByLabelText(/new password/i, { selector: 'input' })).not.toBeInTheDocument()
  })

  it('disables submit until password is 8+ chars and confirmed', () => {
    renderModal()
    expect(submitButton()).toBeDisabled()
    fill('short', 'short')
    expect(submitButton()).toBeDisabled()
    fill('long-enough-pass', 'different')
    expect(submitButton()).toBeDisabled()
    fill('long-enough-pass', 'long-enough-pass')
    expect(submitButton()).toBeEnabled()
  })

  it('shows the strength meter for a short password and an inline mismatch error', () => {
    renderModal()
    fill('short', 'other')
    expect(screen.getByText('Too short')).toBeInTheDocument()
    expect(screen.getByText(/don't match/i)).toBeInTheDocument()
  })

  it('submits the password, shows a success toast, and closes', async () => {
    mockResetPassword.mockResolvedValue({})
    const onClose = renderModal()
    fill('brand-new-pass', 'brand-new-pass')
    fireEvent.click(submitButton())
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('u1', 'brand-new-pass'))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Password reset' }),
      ),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an inline error and stays open when the API call fails', async () => {
    mockResetPassword.mockRejectedValue(new Error('boom'))
    const onClose = renderModal()
    fill('brand-new-pass', 'brand-new-pass')
    fireEvent.click(submitButton())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
