import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverridesEmptyState } from '../OverridesEmptyState'

describe('OverridesEmptyState', () => {
  const onAdd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the empty state title and description', () => {
    render(<OverridesEmptyState onAdd={onAdd} />)
    expect(screen.getByText('No overrides yet')).toBeTruthy()
    expect(
      screen.getByText('Context overrides let you target specific users or groups.'),
    ).toBeTruthy()
  })

  it('renders the Add Override button', () => {
    render(<OverridesEmptyState onAdd={onAdd} />)
    expect(screen.getByRole('button', { name: /add override/i })).toBeTruthy()
  })

  it('calls onAdd when Add Override button is clicked', async () => {
    const user = userEvent.setup()
    render(<OverridesEmptyState onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: /add override/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
