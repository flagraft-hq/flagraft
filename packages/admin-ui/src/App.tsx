import { Route, Routes, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ToastProvider } from './contexts/ToastContext'
import { MainLayout } from './components/layout/MainLayout'
import { FlagsScreen } from './components/screens/FlagsScreen'
import './styles/index.css'

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>{title}</h1>
      <p style={{ color: 'var(--text-3)', marginTop: 8 }}>Coming soon.</p>
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/flags" replace />} />
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
                  <Placeholder title="Flag detail" />
                </MainLayout>
              }
            />
            <Route
              path="/overrides"
              element={
                <MainLayout>
                  <Placeholder title="Overrides" />
                </MainLayout>
              }
            />
            <Route
              path="/audit"
              element={
                <MainLayout>
                  <Placeholder title="Audit log" />
                </MainLayout>
              }
            />
            <Route
              path="/environments"
              element={
                <MainLayout>
                  <Placeholder title="Environments" />
                </MainLayout>
              }
            />
            <Route
              path="/keys"
              element={
                <MainLayout>
                  <Placeholder title="API keys" />
                </MainLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <MainLayout>
                  <Placeholder title="Project settings" />
                </MainLayout>
              }
            />
          </Routes>
        </ProjectProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
