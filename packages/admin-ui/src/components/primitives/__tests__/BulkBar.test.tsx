import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BulkBar, BulkSep } from '../BulkBar'

describe('BulkBar', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <BulkBar count={0} onClear={vi.fn()}>
        <button>Action</button>
      </BulkBar>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count, children, and clear button', () => {
    const onClear = vi.fn()
    render(
      <BulkBar count={3} onClear={onClear}>
        <BulkSep />
        <button>Action</button>
      </BulkBar>,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('omits the clear button when onClear is not provided', () => {
    render(
      <BulkBar count={1}>
        <button>Action</button>
      </BulkBar>,
    )
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument()
  })

  it('disables the clear button while busy', () => {
    render(
      <BulkBar count={1} onClear={vi.fn()} busy>
        <button>Action</button>
      </BulkBar>,
    )
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled()
  })
})
