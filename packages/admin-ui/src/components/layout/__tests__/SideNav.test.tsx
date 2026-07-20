import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { SideNav } from '../SideNav'
import type { NavItemId } from '../SideNav'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.com', name: 'Admin User', role: 'owner' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('SideNav', () => {
  const mockOnNav = vi.fn()

  beforeEach(() => {
    mockOnNav.mockClear()
  })

  it('renders all nav section headings', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument()
    expect(screen.getByText('CONFIGURE')).toBeInTheDocument()
  })

  it('renders all nav item labels', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    expect(screen.getByText('Flags')).toBeInTheDocument()
    expect(screen.getByText('Audit log')).toBeInTheDocument()
    expect(screen.getByText('Environments')).toBeInTheDocument()
    expect(screen.getByText('API keys')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Project settings')).toBeInTheDocument()
  })

  it('calls onNav with the correct id when a nav item is clicked', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    fireEvent.click(screen.getByText('Audit log'))
    expect(mockOnNav).toHaveBeenCalledWith('audit')
  })

  it('calls onNav with the correct id for each item', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)

    const cases: Array<[string, NavItemId]> = [
      ['Flags', 'flags'],
      ['Audit log', 'audit'],
      ['Environments', 'environments'],
      ['API keys', 'keys'],
      ['Users', 'users'],
      ['Project settings', 'settings'],
    ]

    for (const [label, id] of cases) {
      mockOnNav.mockClear()
      fireEvent.click(screen.getByText(label))
      expect(mockOnNav).toHaveBeenCalledWith(id)
    }
  })

  it('current item has aria-current="page"', () => {
    render(<SideNav current="audit" onNav={mockOnNav} />)
    const auditBtn = screen.getByText('Audit log').closest('button')
    expect(auditBtn).toHaveAttribute('aria-current', 'page')
  })

  it('non-current items do NOT have aria-current', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    const auditBtn = screen.getByText('Audit log').closest('button')
    expect(auditBtn).not.toHaveAttribute('aria-current')
    const keysBtn = screen.getByText('API keys').closest('button')
    expect(keysBtn).not.toHaveAttribute('aria-current')
  })

  it('renders the badge count for Flags', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders the sidenav footer with user info', () => {
    render(<SideNav current="flags" onNav={mockOnNav} />)
    expect(screen.getByText('AD')).toBeInTheDocument()
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('renders Users nav item', () => {
    render(<SideNav current="flags" onNav={vi.fn()} />)
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('renders user footer with name and role', () => {
    render(<SideNav current="flags" onNav={vi.fn()} />)
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
  })
})
