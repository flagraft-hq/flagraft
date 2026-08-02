import { Route, Routes, Navigate } from 'react-router-dom'
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
import './styles/index.css'

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 600 }}>{title}</h1>
      <p style={{ color: 'var(--text-3)', marginTop: 8 }}>Coming soon.</p>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/flags" replace /> : <LoginScreen />} />
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
              <KeysScreen />
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
    </Routes>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <AppRoutes />
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
