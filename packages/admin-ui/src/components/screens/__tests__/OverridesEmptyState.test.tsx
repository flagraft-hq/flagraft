import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverridesEmptyState } from '../OverridesEmptyState'

describe('OverridesEmptyState', () => {
  const onAdd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the generic title when no env is given', () => {
    render(<OverridesEmptyState onAdd={onAdd} />)
    expect(screen.getByText('No overrides yet')).toBeTruthy()
  })

  it('renders an env-specific title with the environment name when provided', () => {
    render(<OverridesEmptyState onAdd={onAdd} envName="Development1" />)
    expect(screen.getByText(/No overrides in Development1/i)).toBeTruthy()
  })

  it('renders the description', () => {
    render(<OverridesEmptyState onAdd={onAdd} />)
    expect(screen.getByText(/Add an override to flip the result/i)).toBeTruthy()
  })

  it('renders the primary add button', () => {
    render(<OverridesEmptyState onAdd={onAdd} />)
    expect(screen.getByRole('button', { name: /add your first override/i })).toBeTruthy()
  })

  it('calls onAdd when the add button is clicked', async () => {
    const user = userEvent.setup()
    render(<OverridesEmptyState onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: /add your first override/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
