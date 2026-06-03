import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { App } from './App'

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('./contexts/ProjectContext', () => ({
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProject: () => ({
    projects: [],
    activeProject: null,
    setActiveProject: vi.fn(),
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
  }),
}))

vi.mock('./components/screens/FlagsScreen', () => ({
  FlagsScreen: () => <div>Flags</div>,
}))

vi.mock('./components/screens/FlagDetailScreen', () => ({
  FlagDetailScreen: () => <div>Flag Detail</div>,
}))

vi.mock('./components/screens/LoginScreen', () => ({
  LoginScreen: () => <div>Login</div>,
}))

vi.mock('./components/screens/UsersScreen', () => ({
  UsersScreen: () => <div>Users</div>,
}))

vi.mock('./components/screens/SettingsScreen', () => ({
  SettingsScreen: () => <div>Settings</div>,
}))

vi.mock('./components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('App', () => {
  it('redirects root path to /flags and renders flags screen', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('Flags')).toBeInTheDocument()
  })
})
