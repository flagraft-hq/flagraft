import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { App } from './App'

/** useAuth is configured per-test via mockUseAuth so routing can be tested for both states. */
const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: mockUseAuth,
}))

vi.mock('./contexts/ProjectContext', () => ({
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProject: () => ({
    projects: [],
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 },
    setActiveProject: vi.fn(),
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
  }),
}))

vi.mock('./components/screens/FlagsScreen', () => ({
  FlagsScreen: () => <div data-testid="flags-screen">Flags</div>,
}))

vi.mock('./components/screens/FlagDetailScreen', () => ({
  FlagDetailScreen: () => <div data-testid="flag-detail-screen">Flag Detail</div>,
}))

vi.mock('./components/screens/LoginScreen', () => ({
  LoginScreen: () => <div data-testid="login-screen">Login</div>,
}))

vi.mock('./components/screens/UsersScreen', () => ({
  UsersScreen: () => <div data-testid="users-screen">Users</div>,
}))

vi.mock('./components/screens/SettingsScreen', () => ({
  SettingsScreen: () => <div data-testid="settings-screen">Settings</div>,
}))

vi.mock('./components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}))

const loggedInUser = { id: 'u1', email: 'a@b.com', name: 'Admin', role: 'owner' }

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: loggedInUser,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })
})

describe('Routing — authenticated user', () => {
  it('/ redirects to /flags', () => {
    renderAt('/')
    expect(screen.getByTestId('flags-screen')).toBeInTheDocument()
  })

  it('/flags renders FlagsScreen inside MainLayout', () => {
    renderAt('/flags')
    expect(screen.getByTestId('flags-screen')).toBeInTheDocument()
    expect(screen.getByTestId('main-layout')).toBeInTheDocument()
  })

  it('/flags/:key renders FlagDetailScreen', () => {
    renderAt('/flags/my-flag')
    expect(screen.getByTestId('flag-detail-screen')).toBeInTheDocument()
  })

  it('/users renders UsersScreen', () => {
    renderAt('/users')
    expect(screen.getByTestId('users-screen')).toBeInTheDocument()
  })

  it('/settings renders SettingsScreen', () => {
    renderAt('/settings')
    expect(screen.getByTestId('settings-screen')).toBeInTheDocument()
  })

  it('/overrides renders "Overrides" Coming soon placeholder', () => {
    renderAt('/overrides')
    expect(screen.getByText('Overrides')).toBeInTheDocument()
    expect(screen.getByText('Coming soon.')).toBeInTheDocument()
  })

  it('/audit renders "Audit log" Coming soon placeholder', () => {
    renderAt('/audit')
    expect(screen.getByText('Audit log')).toBeInTheDocument()
    expect(screen.getByText('Coming soon.')).toBeInTheDocument()
  })

  it('/environments renders "Environments" Coming soon placeholder', () => {
    renderAt('/environments')
    expect(screen.getByText('Environments')).toBeInTheDocument()
    expect(screen.getByText('Coming soon.')).toBeInTheDocument()
  })

  it('/keys renders "API keys" Coming soon placeholder', () => {
    renderAt('/keys')
    expect(screen.getByText('API keys')).toBeInTheDocument()
    expect(screen.getByText('Coming soon.')).toBeInTheDocument()
  })

  it('/login redirects to /flags when already authenticated', () => {
    renderAt('/login')
    expect(screen.getByTestId('flags-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument()
  })
})

describe('Routing — unauthenticated user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
  })

  it('/flags redirects to /login when not authenticated', () => {
    renderAt('/flags')
    expect(screen.getByTestId('login-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('flags-screen')).not.toBeInTheDocument()
  })

  it('/users redirects to /login when not authenticated', () => {
    renderAt('/users')
    expect(screen.getByTestId('login-screen')).toBeInTheDocument()
  })

  it('/settings redirects to /login when not authenticated', () => {
    renderAt('/settings')
    expect(screen.getByTestId('login-screen')).toBeInTheDocument()
  })

  it('/login renders LoginScreen when not authenticated', () => {
    renderAt('/login')
    expect(screen.getByTestId('login-screen')).toBeInTheDocument()
  })
})
