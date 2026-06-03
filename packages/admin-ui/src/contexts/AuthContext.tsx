import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, type AuthUser } from '../lib/api'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setUser(res.data)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth called outside AuthProvider')
  return ctx
}
