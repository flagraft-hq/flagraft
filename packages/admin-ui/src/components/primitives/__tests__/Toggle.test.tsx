import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Toggle } from '../Toggle'

describe('Toggle', () => {
  it('renders toggle switch', () => {
    render(<Toggle checked={false} onChange={() => {}} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('shows checked state', () => {
    render(<Toggle checked={true} onChange={() => {}} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange when toggled', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders with label', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Enable feature" />)
    expect(screen.getByText('Enable feature')).toBeTruthy()
  })

  it('has aria-label based on checked state when no label prop given', () => {
    const { rerender } = render(<Toggle checked={true} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Enabled')

    rerender(<Toggle checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Disabled')
  })

  it('renders production variant', () => {
    const { container } = render(
      <Toggle checked={false} onChange={() => {}} variant="production" />,
    )
    const toggle = container.querySelector('[data-variant="production"]')
    expect(toggle).toBeTruthy()
  })

  it('shows confirm dialog when production toggle is clicked while off', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} variant="production" />)
    await userEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Enable production toggle?')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange after confirm yes in production variant', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} variant="production" />)
    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByText('Yes'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('dismisses confirm dialog on No without calling onChange', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} variant="production" />)
    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByText('No'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText('Enable production toggle?')).toBeNull()
  })

  it('applies track-sm class when size is sm', () => {
    const { container } = render(<Toggle checked={false} onChange={() => {}} size="sm" />)
    expect(container.querySelector('.track-sm')).toBeTruthy()
  })

  it('applies track-lg class when size is lg', () => {
    const { container } = render(<Toggle checked={false} onChange={() => {}} size="lg" />)
    expect(container.querySelector('.track-lg')).toBeTruthy()
  })

  it('applies no size modifier class for default size', () => {
    const { container } = render(<Toggle checked={false} onChange={() => {}} size="default" />)
    expect(container.querySelector('.track-sm')).toBeNull()
    expect(container.querySelector('.track-lg')).toBeNull()
  })

  it('production variant checked state carries data-variant and aria-checked', () => {
    const { container } = render(
      <Toggle checked={true} onChange={() => {}} variant="production" />,
    )
    const btn = container.querySelector('[data-variant="production"]')
    expect(btn).toBeTruthy()
    expect(btn).toHaveAttribute('aria-checked', 'true')
  })
})
