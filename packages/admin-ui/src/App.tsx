import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ToastProvider } from './contexts/ToastContext'
import { MainLayout } from './components/layout/MainLayout'
import { FlagsScreen } from './components/screens/FlagsScreen'
import './styles/index.css'

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProjectProvider>
          <Routes>
            <Route
              path="/"
              element={
                <MainLayout>
                  <div style={{ padding: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600 }}>Welcome to Flagraft</h1>
                    <p style={{ color: 'var(--text-3)', marginTop: 8 }}>
                      Select a section from the navigation to get started.
                    </p>
                  </div>
                </MainLayout>
              }
            />
            <Route
              path="/flags"
              element={
                <MainLayout>
                  <FlagsScreen />
                </MainLayout>
              }
            />
            <Route
              path="/flags/:key"
              element={
                <MainLayout>
                  <div style={{ padding: 24, color: 'var(--text-3)' }}>
                    Flag detail view coming soon.
                  </div>
                </MainLayout>
              }
            />
          </Routes>
        </ProjectProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
