import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
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

/** Reports where the screen navigated to after a successful sign-in. */
function LocationDisplay() {
  const { pathname } = useLocation()
  return <span data-testid="loc">{pathname}</span>
}

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LoginScreen />
      <LocationDisplay />
    </MemoryRouter>,
  )
}

/** Fills the form and submits it. */
function signIn() {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockToastPush.mockClear()
})

describe('LoginScreen', () => {
  it('renders email and password fields with sign in button', () => {
    renderLogin()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'secret123'))
  })

  it('lands on /flags after signing in with no return path', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()
    signIn()
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/flags'))
  })

  it('returns to the ?next= path after signing in', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin('/login?next=%2Fkeys')
    signIn()
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/keys'))
  })

  it('ignores an off-site ?next= and lands on /flags', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin('/login?next=https%3A%2F%2Fevil.com')
    signIn()
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/flags'))
  })

  it('shows error alert on failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('displays the exact server error message in the alert', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'),
    )
  })

  it('displays a validation message from the server (e.g. invalid email format)', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'notanemail' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email'))
  })

  it('clears the error when the user starts editing the password', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
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
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
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

  it('reveals the admin-reset hint when "Forgot password?" is clicked', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(screen.getByText(/a workspace admin can reset it/i)).toBeInTheDocument()
  })

  it('offers no auth methods the backend does not support', () => {
    renderLogin()
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/saml/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sign-in link/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/create workspace/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /forgot/i })).not.toBeInTheDocument()
  })
})
