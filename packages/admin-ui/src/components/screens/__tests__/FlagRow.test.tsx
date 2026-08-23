import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from '@heroui/react'
import type { ReactNode } from 'react'
import { FlagRow } from '../FlagRow'
import type { Flag } from '../../../lib/types'

/** Role gating has its own tests; these render as an owner so nothing is disabled. */
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'owner',
    canWrite: true,
    canProjectAdmin: true,
    canOwnerAct: true,
    canWriteEnv: () => true,
  }),
}))

vi.mock('../../../hooks/useRelativeDate', () => ({
  useRelativeDate: () => '2 days ago',
}))

const baseFlag: Flag = {
  key: 'my-feature',
  name: 'My Feature',
  description: 'A test feature flag',
  created: '2025-01-01',
  updated: '2025-01-10',
  state: {
    development: { on: true },
    staging: { on: false },
    production: { on: false },
  },
  author: 'alice',
}

const defaultProps = {
  flag: baseFlag,
  activeEnv: 'development',
  environments: [],
  refetchEnvironments: vi.fn(),
  envNames: ['development', 'staging', 'production'],
  onToggle: vi.fn(),
  onClick: vi.fn(),
}

/**
 * A row only renders inside a table -- React Aria reads the collection from
 * `Table.Body`, so a bare `<FlagRow />` has nowhere to attach. This is the
 * smallest table that makes one row real, including the selection wiring the
 * row's checkbox reaches for through its `selection` slot.
 */
function renderRow(children: ReactNode, selectedKeys: string[] = []) {
  return render(
    <Table>
      <Table.Content aria-label="Flags" selectionMode="multiple" defaultSelectedKeys={selectedKeys}>
        <Table.Header>
          <Table.Column id="select">{''}</Table.Column>
          <Table.Column id="name" isRowHeader>
            Flag
          </Table.Column>
          <Table.Column id="development">development</Table.Column>
          <Table.Column id="staging">staging</Table.Column>
          <Table.Column id="production">production</Table.Column>
          <Table.Column id="updated">Last edited</Table.Column>
        </Table.Header>
        <Table.Body>{children}</Table.Body>
      </Table.Content>
    </Table>,
  )
}

describe('FlagRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders flag name and key', () => {
    renderRow(<FlagRow {...defaultProps} />)
    expect(screen.getByText('My Feature')).toBeTruthy()
    expect(screen.getByText('my-feature')).toBeTruthy()
  })

  it('renders a StatePill for each env in envNames', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} />)
    const pills = container.querySelectorAll('.state-pill')
    expect(pills.length).toBe(3)
  })

  it('renders a Toggle for each env in envNames', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    expect(toggles.length).toBe(3)
  })

  it('clicking the Toggle for an env calls onToggle with correct (key, env, enabled) args', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = renderRow(<FlagRow {...defaultProps} onToggle={onToggle} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    // development toggle (index 0): current state is on=true, clicking turns it off
    await user.click(toggles[0])
    expect(onToggle).toHaveBeenCalledWith('my-feature', 'development', false)
  })

  it('clicking the Toggle for staging calls onToggle with correct args', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { container } = renderRow(<FlagRow {...defaultProps} onToggle={onToggle} />)
    const toggles = container.querySelectorAll('[role="switch"]')
    // staging toggle (index 1): current state is on=false, clicking turns it on
    await user.click(toggles[1])
    expect(onToggle).toHaveBeenCalledWith('my-feature', 'staging', true)
  })

  it('active env cell has class cell-env-active', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} activeEnv="development" />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells.length).toBe(3)
    expect(envCells[0].classList.contains('cell-env-active')).toBe(true)
    expect(envCells[1].classList.contains('cell-env-active')).toBe(false)
    expect(envCells[2].classList.contains('cell-env-active')).toBe(false)
  })

  it('changes active env highlight when activeEnv is staging', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} activeEnv="staging" />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells[0].classList.contains('cell-env-active')).toBe(false)
    expect(envCells[1].classList.contains('cell-env-active')).toBe(true)
    expect(envCells[2].classList.contains('cell-env-active')).toBe(false)
  })

  it('marks the production env cell with cell-env-prod', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} />)
    const envCells = container.querySelectorAll('.cell-env')
    expect(envCells[2].classList.contains('cell-env-prod')).toBe(true)
  })

  it('renders correct on/off state per env in StatePills', () => {
    renderRow(<FlagRow {...defaultProps} />)
    const onPills = screen.getAllByText('on')
    const offPills = screen.getAllByText('off')
    // development is on, staging and production are off
    expect(onPills.length).toBe(1)
    expect(offPills.length).toBe(2)
  })

  it('renders an unselected row with an unchecked selection checkbox', () => {
    renderRow(<FlagRow {...defaultProps} />)
    expect(screen.getByRole('checkbox', { name: /^Select My Feature/ })).not.toBeChecked()
    expect(screen.getByRole('row', { name: /my feature/i })).not.toHaveAttribute('data-selected')
  })

  it('renders a selected row with a checked selection checkbox', () => {
    renderRow(<FlagRow {...defaultProps} />, ['my-feature'])
    expect(screen.getByRole('checkbox', { name: /^Select My Feature/ })).toBeChecked()
  })

  it('clicking the checkbox selects the row', async () => {
    const user = userEvent.setup()
    renderRow(<FlagRow {...defaultProps} />)
    await user.click(screen.getByRole('checkbox', { name: /^Select My Feature/ }))
    expect(screen.getByRole('row', { name: /my feature/i })).toHaveAttribute(
      'data-selected',
      'true',
    )
  })

  it('clicking the checkbox again deselects the row', async () => {
    const user = userEvent.setup()
    renderRow(<FlagRow {...defaultProps} />, ['my-feature'])
    await user.click(screen.getByRole('checkbox', { name: /^Select My Feature/ }))
    expect(screen.getByRole('row', { name: /my feature/i })).not.toHaveAttribute('data-selected')
  })

  it('clicking the name area calls onClick with the flag key', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderRow(<FlagRow {...defaultProps} onClick={onClick} />)
    await user.click(screen.getByText('My Feature'))
    expect(onClick).toHaveBeenCalledWith('my-feature')
  })

  it('shows relative date for updated field', () => {
    renderRow(<FlagRow {...defaultProps} />)
    expect(screen.getByText('2 days ago')).toBeTruthy()
  })

  it('renders row with correct role', () => {
    const { container } = renderRow(<FlagRow {...defaultProps} />)
    expect(container.querySelector('.flags-row[role="row"]')).toBeTruthy()
  })

  it('renders without tag chips and does not crash when flag has no tags', () => {
    const flag = { ...baseFlag, tags: [] }
    renderRow(<FlagRow {...defaultProps} flag={flag} />)
    expect(screen.queryByText('tag-a')).toBeNull()
    expect(screen.queryByText('tag-b')).toBeNull()
    // Row itself must still render
    expect(screen.getByText('My Feature')).toBeTruthy()
  })

  it('renders with envs missing from flag state gracefully', () => {
    const flag = { ...baseFlag, state: {} }
    const { container } = renderRow(<FlagRow {...defaultProps} flag={flag} />)
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
      const { container } = renderRow(<FlagRow {...defaultProps} onToggle={onToggle} />)
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
      const { container } = renderRow(<FlagRow {...defaultProps} />)
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
      const { container } = renderRow(<FlagRow {...defaultProps} onToggle={onToggle} />)
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
      const { container } = renderRow(<FlagRow {...defaultProps} onToggle={onToggle} />)
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
          production: { on: true },
        },
      }
      const { container } = renderRow(<FlagRow {...defaultProps} flag={flag} onToggle={onToggle} />)
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
