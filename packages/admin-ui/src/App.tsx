import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import './styles/index.css'

export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Placeholder />} />
      </Routes>
    </ThemeProvider>
  )
}

function Placeholder() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl w-full rounded-2xl bg-surface shadow-sm border border-surface-subtle p-10">
        <h1 className="text-3xl font-semibold text-brand-700">Flagraft Admin</h1>
        <p className="mt-3 text-slate-600">
          Boilerplate ready. Login, projects, flags, and overrides screens land in upcoming tasks.
        </p>
      </div>
    </main>
  )
}
