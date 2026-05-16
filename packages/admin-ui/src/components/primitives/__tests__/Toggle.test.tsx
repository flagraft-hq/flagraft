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

  it('renders production variant', () => {
    const { container } = render(
      <Toggle checked={false} onChange={() => {}} variant="production" />,
    )
    const toggle = container.querySelector('[data-variant="production"]')
    expect(toggle).toBeTruthy()
  })
})
