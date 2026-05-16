import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { MainLayout } from './components/layout/MainLayout'
import './styles/index.css'

export function App() {
  return (
    <ThemeProvider>
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
      </Routes>
    </ThemeProvider>
  )
}
