import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Checkbox } from '../Checkbox'

describe('Checkbox', () => {
  it('renders unchecked checkbox', () => {
    render(<Checkbox checked={false} onChange={() => {}} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('renders checked checkbox', () => {
    render(<Checkbox checked={true} onChange={() => {}} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  it('renders indeterminate state', () => {
    render(<Checkbox checked={false} indeterminate={true} onChange={() => {}} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed')
  })

  it('calls onChange when clicked', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles checked state on click', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={true} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('renders with label', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Accept terms" />)
    expect(screen.getByText('Accept terms')).toBeTruthy()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Checkbox checked={false} onChange={() => {}} disabled={true} />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('displays check icon when checked', () => {
    const { container } = render(<Checkbox checked={true} onChange={() => {}} />)
    const icon = container.querySelector('.checkbox-icon svg')
    expect(icon).toBeTruthy()
  })

  it('displays minus icon when indeterminate', () => {
    const { container } = render(
      <Checkbox checked={false} indeterminate={true} onChange={() => {}} />,
    )
    const icon = container.querySelector('.checkbox-icon svg')
    expect(icon).toBeTruthy()
  })

  it('does not display icon when unchecked and not indeterminate', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} />)
    const icon = container.querySelector('.checkbox-icon')
    expect(icon).toBeNull()
  })
})
