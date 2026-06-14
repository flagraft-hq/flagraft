import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatePill } from '../StatePill'

const defaultProps = {
  on: false,
  env: 'development',
  onToggle: vi.fn(),
}

describe('StatePill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "on" label when on={true}', () => {
    render(<StatePill {...defaultProps} on={true} />)
    expect(screen.getByText('on')).toBeTruthy()
  })

  it('has class state-pill-on when on={true}', () => {
    const { container } = render(<StatePill {...defaultProps} on={true} />)
    expect(container.querySelector('.state-pill-on')).toBeTruthy()
  })

  it('renders "off" label when on={false}', () => {
    render(<StatePill {...defaultProps} on={false} />)
    expect(screen.getByText('off')).toBeTruthy()
  })

  it('has class state-pill-off when on={false}', () => {
    const { container } = render(<StatePill {...defaultProps} on={false} />)
    expect(container.querySelector('.state-pill-off')).toBeTruthy()
  })

  it('renders a Toggle switch', () => {
    const { container } = render(<StatePill {...defaultProps} />)
    expect(container.querySelector('[role="switch"]')).toBeTruthy()
  })

  it('sets the data-env attribute', () => {
    const { container } = render(<StatePill {...defaultProps} env="staging" />)
    expect(container.querySelector('.state-pill')?.getAttribute('data-env')).toBe('staging')
  })

  it('clicking the toggle calls onToggle with the negated value', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = render(<StatePill {...defaultProps} on={false} onToggle={onToggle} />)
    await user.click(container.querySelector('[role="switch"]') as HTMLElement)
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('shows overrides count and has-overrides class when overrides > 0', () => {
    const { container } = render(<StatePill {...defaultProps} on={true} overrides={3} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(container.querySelector('.state-pill-overrides')).toBeTruthy()
    expect(container.querySelector('.state-pill.has-overrides')).toBeTruthy()
  })

  it('does not show overrides element when overrides is 0', () => {
    const { container } = render(<StatePill {...defaultProps} on={true} overrides={0} />)
    expect(container.querySelector('.state-pill-overrides')).toBeNull()
    expect(container.querySelector('.has-overrides')).toBeNull()
  })

  it('does not show overrides element when overrides is undefined', () => {
    const { container } = render(<StatePill {...defaultProps} on={false} />)
    expect(container.querySelector('.state-pill-overrides')).toBeNull()
  })
})
