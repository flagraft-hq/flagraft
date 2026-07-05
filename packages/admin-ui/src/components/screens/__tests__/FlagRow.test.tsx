import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlagRow } from '../FlagRow'
import type { Flag } from '../../../lib/types'

vi.mock('../../../hooks/useRelativeDate', () => ({
  useRelativeDate: () => '2 days ago',
}))

const baseFlag: Flag = {
  key: 'my-feature',
  name: 'My Feature',
  description: 'A test feature flag',
  tags: ['tag-a', 'tag-b'],
  created: '2025-01-01',
  updated: '2025-01-10',
  state: {
    development: { on: true, overrides: 2 },
    staging: { on: false, overrides: 0 },
    production: { on: false, overrides: 1 },
  },
  author: 'alice',
}

const defaultProps = {
  flag: baseFlag,
  activeEnv: 'development',
  environments: [],
  refetchEnvironments: vi.fn(),
  envNames: ['development', 'staging', 'production'],
  selected: false,
  onSelect: vi.fn(),
  onToggle: vi.fn(),
  onClick: vi.fn(),
}

describe('FlagRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders flag name and key', () => {
    render(<FlagRow {...defaultProps} />)
    expect(screen.getByText('My Feature')).toBeTruthy()
    expect(screen.getByText('my-feature')).toBeTruthy()
  })

  it('renders a StatePill for each env in envNames', () => {
    const { container } = render(<FlagRow {...defaultProps} />)
    const pills = container.querySelectorAll('.state-pill')
    expect(pills.length).toBe(3)
  })

  it('renders a Toggle for each env in envNames', () => {
    const { container } = render(<FlagRow {...defaultProps} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    expect(toggles.length).toBe(3)
  })

  it('clicking the Toggle for an env calls onToggle with correct (key, env, enabled) args', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = render(<FlagRow {...defaultProps} onToggle={onToggle} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    // development toggle (index 0): current state is on=true, clicking turns it off
    await user.click(toggles[0])
    expect(onToggle).toHaveBeenCalledWith('my-feature', 'development', false)
  })

  it('clicking the Toggle for staging calls onToggle with correct args', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = render(<FlagRow {...defaultProps} onToggle={onToggle} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    // staging toggle (index 1): current state is on=false, clicking turns it on
    await user.click(toggles[1])
    expect(onToggle).toHaveBeenCalledWith('my-feature', 'staging', true)
  })

  it('active env cell has class cell-env-active', () => {
    const { container } = render(<FlagRow {...defaultProps} activeEnv="development" />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells.length).toBe(3)
    expect(envCells[0].classList.contains('cell-env-active')).toBe(true)
    expect(envCells[1].classList.contains('cell-env-active')).toBe(false)
    expect(envCells[2].classList.contains('cell-env-active')).toBe(false)
  })

  it('changes active env highlight when activeEnv is staging', () => {
    const { container } = render(<FlagRow {...defaultProps} activeEnv="staging" />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells[0].classList.contains('cell-env-active')).toBe(false)
    expect(envCells[1].classList.contains('cell-env-active')).toBe(true)
    expect(envCells[2].classList.contains('cell-env-active')).toBe(false)
  })

  it('marks the production env cell with cell-env-prod', () => {
    const { container } = render(<FlagRow {...defaultProps} />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells[2].classList.contains('cell-env-prod')).toBe(true)
  })

  it('renders correct on/off state per env in StatePills', () => {
    render(<FlagRow {...defaultProps} />)
    const onPills = screen.getAllByText('on')
    const offPills = screen.getAllByText('off')
    // development is on, staging and production are off
    expect(onPills.length).toBe(1)
    expect(offPills.length).toBe(2)
  })

  it('renders TagCluster with flag tags', () => {
    render(<FlagRow {...defaultProps} />)
    expect(screen.getByText('tag-a')).toBeTruthy()
    expect(screen.getByText('tag-b')).toBeTruthy()
  })

  it('renders checkbox in unchecked state when selected=false', () => {
    const { container } = render(<FlagRow {...defaultProps} selected={false} />)
    const checkbox = container.querySelector('[role="checkbox"]')
    expect(checkbox).toBeTruthy()
    expect(checkbox?.getAttribute('aria-checked')).toBe('false')
  })

  it('renders checkbox in checked state when selected=true', () => {
    const { container } = render(<FlagRow {...defaultProps} selected={true} />)
    const checkbox = container.querySelector('[role="checkbox"]')
    expect(checkbox?.getAttribute('aria-checked')).toBe('true')
  })

  it('clicking checkbox calls onSelect with flag key and toggled value', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(<FlagRow {...defaultProps} selected={false} onSelect={onSelect} />)
    const checkbox = container.querySelector('[role="checkbox"]') as HTMLElement
    await user.click(checkbox)
    expect(onSelect).toHaveBeenCalledWith('my-feature', true)
  })

  it('clicking checkbox when selected=true calls onSelect with false', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(<FlagRow {...defaultProps} selected={true} onSelect={onSelect} />)
    const checkbox = container.querySelector('[role="checkbox"]') as HTMLElement
    await user.click(checkbox)
    expect(onSelect).toHaveBeenCalledWith('my-feature', false)
  })

  it('clicking the name area calls onClick with the flag key', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<FlagRow {...defaultProps} onClick={onClick} />)
    await user.click(screen.getByText('My Feature'))
    expect(onClick).toHaveBeenCalledWith('my-feature')
  })

  it('shows relative date for updated field', () => {
    render(<FlagRow {...defaultProps} />)
    expect(screen.getByText('2 days ago')).toBeTruthy()
  })

  it('renders row with correct role', () => {
    const { container } = render(<FlagRow {...defaultProps} />)
    expect(container.querySelector('[role="row"]')).toBeTruthy()
    expect(container.querySelector('.flags-row')).toBeTruthy()
  })

  it('renders without tag chips and does not crash when flag has no tags', () => {
    const flag = { ...baseFlag, tags: [] }
    render(<FlagRow {...defaultProps} flag={flag} />)
    expect(screen.queryByText('tag-a')).toBeNull()
    expect(screen.queryByText('tag-b')).toBeNull()
    // Row itself must still render
    expect(screen.getByText('My Feature')).toBeTruthy()
  })

  it('renders with envs missing from flag state gracefully', () => {
    const flag = { ...baseFlag, state: {} }
    const { container } = render(<FlagRow {...defaultProps} flag={flag} />)
    const pills = container.querySelectorAll('.state-pill')
    // Still renders 3 pills (all off) even with missing state
    expect(pills.length).toBe(3)
    const offPills = screen.getAllByText('off')
    expect(offPills.length).toBe(3)
  })

  describe('production env confirmation modal', () => {
    it('shows confirmation modal when enabling a production env toggle instead of calling onToggle immediately', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      const { container } = render(<FlagRow {...defaultProps} onToggle={onToggle} />)
      const toggles = container.querySelectorAll('[role="switch"]')
      // production toggle (index 2): current state is on=false, clicking would enable it
      await user.click(toggles[2])
      // onToggle should NOT have been called yet
      expect(onToggle).not.toHaveBeenCalled()
      // Modal should be visible
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText('Enable in Production?')).toBeTruthy()
    })

    it('modal shows flag name and env in confirmation message', async () => {
      const user = userEvent.setup()
      const { container } = render(<FlagRow {...defaultProps} />)
      const toggles = container.querySelectorAll('[role="switch"]')
      await user.click(toggles[2])
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('My Feature')
      expect(dialog.textContent).toContain('production')
      expect(dialog.textContent).toContain('production traffic')
    })

    it('confirming the modal calls onToggle with enabled=true and closes modal', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      const { container } = render(<FlagRow {...defaultProps} onToggle={onToggle} />)
      const toggles = container.querySelectorAll('[role="switch"]')
      await user.click(toggles[2])
      // Click the Enable button
      const enableBtn = screen.getByRole('button', { name: /enable/i })
      await user.click(enableBtn)
      expect(onToggle).toHaveBeenCalledWith('my-feature', 'production', true)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('canceling the modal does NOT call onToggle and closes the modal', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      const { container } = render(<FlagRow {...defaultProps} onToggle={onToggle} />)
      const toggles = container.querySelectorAll('[role="switch"]')
      await user.click(toggles[2])
      // Click the Cancel button
      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelBtn)
      expect(onToggle).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('disabling a production env toggle shows confirmation modal and calls onToggle after confirm', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      // Set production to on=true so clicking it will disable it
      const flag = {
        ...baseFlag,
        state: {
          ...baseFlag.state,
          production: { on: true, overrides: 1 },
        },
      }
      const { container } = render(<FlagRow {...defaultProps} flag={flag} onToggle={onToggle} />)
      const toggles = container.querySelectorAll('[role="switch"]')
      await user.click(toggles[2])
      // onToggle should not be called yet
      expect(onToggle).not.toHaveBeenCalled()
      // Expect modal confirmation
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Disable in Production?')).toBeInTheDocument()
      // Confirm modal
      await user.click(screen.getByRole('button', { name: /disable/i }))
      expect(onToggle).toHaveBeenCalledWith('my-feature', 'production', false)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
