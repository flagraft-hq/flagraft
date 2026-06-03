import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'

vi.mock('../../lib/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))

import type { AxiosResponse } from 'axios'
import type { AuthUser } from '../../lib/api'
import { authApi } from '../../lib/api'

function Consumer() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? user.email : 'unauthenticated'}</div>
}

beforeEach(() => vi.clearAllMocks())

describe('AuthProvider', () => {
  it('resolves user from me()', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      data: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    } as unknown as AxiosResponse<AuthUser>)
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('a@b.com')).toBeInTheDocument())
  })

  it('shows unauthenticated when me() fails', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeInTheDocument())
  })

  it('useAuth throws when called outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useAuth called outside AuthProvider')
    consoleSpy.mockRestore()
  })
})
