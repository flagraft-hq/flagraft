import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ErrorState } from '../ErrorState'

describe('ErrorState', () => {
  it('renders title and message', () => {
    render(<ErrorState title="Something went wrong" message="Please try again later" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Something went wrong')
    expect(screen.getByText('Please try again later')).toBeTruthy()
  })

  it('renders retry button when onRetry provided', () => {
    render(<ErrorState title="Error" message="Could not load" onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('does not render retry button when onRetry omitted', () => {
    render(<ErrorState title="Error" message="Could not load" />)
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('calls onRetry when retry button clicked', async () => {
    const onRetry = vi.fn()
    render(<ErrorState title="Error" message="Could not load" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders alert icon', () => {
    const { container } = render(<ErrorState title="Error" message="Failed" />)
    expect(container.querySelector('.error-state-icon svg')).toBeTruthy()
  })
})
