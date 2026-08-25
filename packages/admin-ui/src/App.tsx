import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import React from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MainLayout } from './components/layout/MainLayout'
import { FlagsScreen } from './components/screens/FlagsScreen'
import { FlagDetailScreen } from './components/screens/FlagDetailScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { LoginScreen } from './components/screens/LoginScreen'
import { AcceptInviteScreen } from './components/screens/AcceptInviteScreen'
import { UsersScreen } from './components/screens/UsersScreen'
import { EnvironmentsScreen } from './components/screens/EnvironmentsScreen'
import { KeysScreen } from './components/screens/KeysScreen'
import { NotFoundScreen } from './components/screens/NotFoundScreen'
import { ForbiddenScreen } from './components/screens/ForbiddenScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { loginUrlFor, safeNext } from './lib/nextPath'
import { usePermissions } from './hooks/usePermissions'
import './styles/index.css'

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 600 }}>{title}</h1>
      <p style={{ color: 'var(--text-3)', marginTop: 8 }}>Coming soon.</p>
    </div>
  )
}

/**
 * Gates a route on a signed-in session. Signed-out visitors go to the login
 * screen with where they were headed attached, so signing in returns them to
 * the link they followed rather than the default screen.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  if (loading) return null
  if (!user) return <Navigate to={loginUrlFor(pathname, search)} replace />
  return <>{children}</>
}

/**
 * Gates a route on role, not just on being signed in. Hiding a nav item is
 * not access control by itself -- without this, typing the URL would still
 * render the screen.
 */
function RequireProjectAdmin({ action, children }: { action: string; children: React.ReactNode }) {
  const { canProjectAdmin } = usePermissions()
  if (!canProjectAdmin) return <ForbiddenScreen action={action} />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const { search } = useLocation()
  if (loading) return null

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={safeNext(search)} replace /> : <LoginScreen />}
      />
      <Route path="/invite/:token" element={<AcceptInviteScreen />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Navigate to="/flags" replace />
          </RequireAuth>
        }
      />
      <Route
        path="/flags"
        element={
          <RequireAuth>
            <MainLayout>
              <FlagsScreen />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/flags/:key"
        element={
          <RequireAuth>
            <MainLayout>
              <FlagDetailScreen />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <MainLayout>
              <UsersScreen />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/audit"
        element={
          <RequireAuth>
            <MainLayout>
              <Placeholder title="Audit log" />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/environments"
        element={
          <RequireAuth>
            <MainLayout>
              <EnvironmentsScreen />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/keys"
        element={
          <RequireAuth>
            <MainLayout>
              <RequireProjectAdmin action="manage API keys">
                <KeysScreen />
              </RequireProjectAdmin>
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <MainLayout>
              <SettingsScreen />
            </MainLayout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  )
}

/**
 * Wraps the routed screens so a crash in one screen shows the 500 page rather
 * than a blank document. Keyed on the path, so navigating away recovers.
 */
function RoutesWithBoundary() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <AppRoutes />
    </ErrorBoundary>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              <RoutesWithBoundary />
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
