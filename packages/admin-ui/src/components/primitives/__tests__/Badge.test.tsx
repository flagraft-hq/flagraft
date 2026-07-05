import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders badge with text', () => {
    render(<Badge>Tag</Badge>)
    expect(screen.getByText('Tag')).toBeTruthy()
  })

  it('renders with variant', () => {
    const { container } = render(<Badge variant="primary">Label</Badge>)
    const badge = container.querySelector('.badge-primary')
    expect(badge).toBeTruthy()
  })

  it('renders danger variant', () => {
    const { container } = render(<Badge variant="danger">Error</Badge>)
    const badge = container.querySelector('.badge-danger')
    expect(badge).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom">Tag</Badge>)
    const badge = container.querySelector('.badge.custom')
    expect(badge).toBeTruthy()
  })

  it('renders leading dot when dot prop is true', () => {
    const { container } = render(<Badge dot>Status</Badge>)
    const dot = container.querySelector('.badge-dot')
    expect(dot).toBeTruthy()
  })

  it('does not render dot by default', () => {
    const { container } = render(<Badge>Status</Badge>)
    const dot = container.querySelector('.badge-dot')
    expect(dot).toBeNull()
  })

  it('applies mono class when mono prop is true', () => {
    const { container } = render(<Badge mono>v1.2.3</Badge>)
    const badge = container.querySelector('.badge-mono')
    expect(badge).toBeTruthy()
  })

  it('does not apply mono class by default', () => {
    const { container } = render(<Badge>Label</Badge>)
    const badge = container.querySelector('.badge-mono')
    expect(badge).toBeNull()
  })

  it('renders success variant using teal tone', () => {
    const { container } = render(<Badge variant="success">Live</Badge>)
    const badge = container.querySelector('.badge-success')
    expect(badge).toBeTruthy()
  })

  it('renders warning variant', () => {
    const { container } = render(<Badge variant="warning">Draft</Badge>)
    const badge = container.querySelector('.badge-warning')
    expect(badge).toBeTruthy()
  })

  it('renders default variant when no variant is given', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.querySelector('.badge-default')
    expect(badge).toBeTruthy()
  })
})
