import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ShortcutsHelpModal } from '../ShortcutsHelpModal'

describe('ShortcutsHelpModal', () => {
  it('renders when open is true', () => {
    render(<ShortcutsHelpModal open={true} onClose={() => {}} />)
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(<ShortcutsHelpModal open={false} onClose={() => {}} />)
    expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<ShortcutsHelpModal open={true} onClose={onClose} />)
    const backdrop = container.querySelector('.modal-backdrop')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the three shortcut rows', () => {
    render(<ShortcutsHelpModal open={true} onClose={() => {}} />)
    expect(screen.getByText('Search flags')).toBeInTheDocument()
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Close modal / clear focus')).toBeInTheDocument()
  })
})
