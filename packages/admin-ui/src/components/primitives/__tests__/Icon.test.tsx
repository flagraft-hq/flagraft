import { render } from '@testing-library/react'
import { Icon } from '../Icon'

describe('Icon', () => {
  it('renders SVG sized in rem so it tracks the global scale', () => {
    const { container } = render(<Icon name="check" size={24} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '1.5rem')
    expect(svg).toHaveAttribute('height', '1.5rem')
  })

  it('applies custom className', () => {
    const { container } = render(<Icon name="flag" className="text-red-600" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('text-red-600')
  })

  it('renders with rest props', () => {
    const { container } = render(<Icon name="flag" data-testid="icon" />)
    const svg = container.querySelector('[data-testid="icon"]')
    expect(svg).toBeTruthy()
  })
})
