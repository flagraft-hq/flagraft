import React, { createContext, useState, useEffect, ReactNode } from 'react'

export type Theme = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'
export type Accent = 'teal' | 'indigo' | 'violet' | 'rose'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  density: Density
  setDensity: (density: Density) => void
  accent: Accent
  setAccent: (accent: Accent) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const ACCENT_COLORS = {
  teal: { 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' },
  indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
  rose: { 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [density, setDensity] = useState<Density>('comfortable')
  const [accent, setAccent] = useState<Accent>('teal')

  /**
   * Our stylesheets key off `theme-light` / `theme-dark`. HeroUI keys off a
   * plain `dark` class. Both are applied so the two styling systems agree on
   * which theme is active. The `dark` class goes away once the last
   * hand-written stylesheet does.
   */
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(`theme-${theme}`)
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('compact', density === 'compact')
  }, [density])

  useEffect(() => {
    const colors = ACCENT_COLORS[accent]
    const root = document.documentElement.style
    root.setProperty('--teal-400', colors[400])
    root.setProperty('--teal-500', colors[500])
    root.setProperty('--teal-600', colors[600])
    root.setProperty('--teal-700', colors[700])
  }, [accent])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme called outside ThemeProvider')
  return ctx
}
