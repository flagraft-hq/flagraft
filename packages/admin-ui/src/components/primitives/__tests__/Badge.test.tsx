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
})
