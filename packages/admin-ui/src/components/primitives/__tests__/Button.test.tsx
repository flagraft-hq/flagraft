import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('default variant has only the base btn class, no extra variant class', () => {
    const { container } = render(<Button>Default</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn?.className.trim()).toBe('btn')
  })

  it('renders primary variant', () => {
    const { container } = render(<Button variant="primary">Primary</Button>)
    const btn = container.querySelector('button')
    // class scheme: "btn primary" (no prefix), matching design CSS .btn.primary
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('primary')
  })

  it('renders ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('ghost')
  })

  it('renders danger variant (outline style)', () => {
    const { container } = render(<Button variant="danger">Danger</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('danger')
    // outline danger must NOT have the solid class
    expect(btn).not.toHaveClass('solid')
  })

  it('renders danger-solid variant (filled red)', () => {
    const { container } = render(<Button variant="danger-solid">Delete</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('danger')
    expect(btn).toHaveClass('solid')
  })

  it('renders sm size', () => {
    const { container } = render(<Button size="sm">Small</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('sm')
  })

  it('renders lg size', () => {
    const { container } = render(<Button size="lg">Large</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('lg')
  })

  it('renders icon-only square treatment', () => {
    const { container } = render(<Button iconOnly leftIcon="plus" aria-label="Add" />)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('icon-only')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders with left icon', () => {
    const { container } = render(<Button leftIcon="plus">Add</Button>)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
  })

  it('renders with right icon', () => {
    const { container } = render(<Button rightIcon="arrowRight">Next</Button>)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  it('passes extra className through', () => {
    const { container } = render(<Button className="my-custom">Btn</Button>)
    const btn = container.querySelector('button')
    expect(btn).toHaveClass('btn')
    expect(btn).toHaveClass('my-custom')
  })
})
