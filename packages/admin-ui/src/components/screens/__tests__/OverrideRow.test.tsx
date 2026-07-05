import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverrideRow } from '../OverrideRow'
import type { Override } from '../../../lib/types'

vi.mock('../../../hooks/useRelativeDate', () => ({
  useRelativeDate: () => '3 days ago',
}))

const baseOverride: Override = {
  id: 'ovr-1',
  flag: 'my-flag',
  env: 'development',
  key: 'userId',
  op: 'equals',
  val: '42',
  result: true,
  note: 'Test note',
  created: '2026-05-10',
}

describe('OverrideRow', () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders key, operator label, and (quoted) value', () => {
    render(<OverrideRow override={baseOverride} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText('userId')).toBeTruthy()
    expect(screen.getByText('equals')).toBeTruthy()
    expect(screen.getByText(/42/)).toBeTruthy()
  })

  it('shows "ON" with class result.on when result is true', () => {
    const { container } = render(
      <OverrideRow
        override={{ ...baseOverride, result: true }}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('ON')).toBeTruthy()
    expect(container.querySelector('.result.on')).toBeTruthy()
    expect(container.querySelector('.result.off')).toBeNull()
  })

  it('shows "OFF" with class result.off when result is false', () => {
    const { container } = render(
      <OverrideRow
        override={{ ...baseOverride, result: false }}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('OFF')).toBeTruthy()
    expect(container.querySelector('.result.off')).toBeTruthy()
    expect(container.querySelector('.result.on')).toBeNull()
  })

  it('renders a human-readable operator label (startsWith → "starts with")', () => {
    render(
      <OverrideRow
        override={{ ...baseOverride, op: 'startsWith' }}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('starts with')).toBeTruthy()
  })

  it('shows note when provided', () => {
    render(
      <OverrideRow
        override={{ ...baseOverride, note: 'Special note' }}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('Special note')).toBeTruthy()
  })

  it('hides note element when note is empty', () => {
    const { container } = render(
      <OverrideRow override={{ ...baseOverride, note: '' }} onEdit={onEdit} onDelete={onDelete} />,
    )
    expect(container.querySelector('.note')).toBeNull()
  })

  it('shows relative created date', () => {
    render(<OverrideRow override={baseOverride} onEdit={onEdit} onDelete={onDelete} />)
    expect(screen.getByText('3 days ago')).toBeTruthy()
  })

  it('calls onEdit with the override object when Edit is clicked', async () => {
    const user = userEvent.setup()
    render(<OverrideRow override={baseOverride} onEdit={onEdit} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(baseOverride)
  })

  it('calls onDelete with the override id when Delete is clicked', async () => {
    const user = userEvent.setup()
    render(<OverrideRow override={baseOverride} onEdit={onEdit} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('ovr-1')
  })
})
