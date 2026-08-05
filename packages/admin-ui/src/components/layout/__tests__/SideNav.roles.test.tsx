import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { SideNav } from '../SideNav'

/** The mock factory is hoisted, so the role has to live somewhere it can reach. */
const state = vi.hoisted(() => ({ role: 'owner' }))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.com', name: 'A', role: state.role },
    loading: false,
    logout: vi.fn(),
  }),
}))

describe('SideNav role gating', () => {
  it.each(['owner', 'admin'])('shows the Users link to an %s', (role) => {
    state.role = role
    render(<SideNav current="flags" onNav={vi.fn()} />)
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it.each(['editor', 'viewer'])('hides the Users link from an %s', (role) => {
    state.role = role
    render(<SideNav current="flags" onNav={vi.fn()} />)
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    /** Everything else in that group still shows. */
    expect(screen.getByText('Environments')).toBeInTheDocument()
    expect(screen.getByText('API keys')).toBeInTheDocument()
    expect(screen.getByText('Project settings')).toBeInTheDocument()
  })
})
