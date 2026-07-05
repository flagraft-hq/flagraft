import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LoginScreen } from '../LoginScreen'

const mockLogin = vi.fn()

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, user: null, loading: false, logout: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  workspaceApi: {
    info: vi.fn().mockResolvedValue({ data: { projectName: 'Default', flagCount: 5 } }),
  },
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
}))

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush }),
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockToastPush.mockClear()
})

describe('LoginScreen', () => {
  it('renders email and password fields with sign in button', () => {
    renderLogin()
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'secret123'))
  })

  it('shows error alert on failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('displays the exact server error message in the alert', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'),
    )
  })

  it('displays a validation message from the server (e.g. invalid email format)', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'notanemail' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email'))
  })

  it('clears the error when the user starts editing the password', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'n' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables sign in button while submitting', async () => {
    let resolve!: () => void
    mockLogin.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r
      }),
    )
    renderLogin()
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    resolve()
  })

  it('toggles password visibility', () => {
    renderLogin()
    const pwInput = screen.getByLabelText(/password/i)
    expect(pwInput).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(pwInput).toHaveAttribute('type', 'text')
  })

  it('shows Caps Lock warning when Caps Lock is active on the password field', () => {
    renderLogin()
    const pwInput = screen.getByLabelText(/^password/i)
    const spy = vi.spyOn(KeyboardEvent.prototype, 'getModifierState').mockReturnValue(true)
    try {
      fireEvent.keyUp(pwInput, { key: 'A' })
      expect(screen.getByText(/caps lock is on/i)).toBeInTheDocument()
    } finally {
      spy.mockRestore()
    }
  })

  it('"Continue with Google" button shows a "Coming soon" toast', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Coming soon', variant: 'error' }),
    )
  })
})
