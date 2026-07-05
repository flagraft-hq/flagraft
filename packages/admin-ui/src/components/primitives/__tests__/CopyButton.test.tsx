import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CopyButton } from '../CopyButton'

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockResolvedValue(undefined)
  // navigator.clipboard is a getter-only property in jsdom, so define it.
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

describe('CopyButton', () => {
  it('writes the value to the clipboard on click', async () => {
    render(<CopyButton value="api.flagraft.io/v1/production" />)
    await userEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('api.flagraft.io/v1/production')
  })

  it('shows "Copied" feedback after a successful copy, then reverts', async () => {
    render(<CopyButton value="x" label="Copy" copiedLabel="Copied" />)
    expect(screen.getByText('Copy')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))

    // findBy flushes the clipboard promise; the button enters the copied state.
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveClass('is-copied')

    // Reverts on its own after the 1.5s timer.
    await waitFor(() => expect(screen.getByText('Copy')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('does not show feedback when the copy fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<CopyButton value="x" label="Copy" copiedLabel="Copied" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('renders an accessible icon-only variant', async () => {
    render(<CopyButton value="user-123" iconOnly tip="Copy user ID" />)
    const button = screen.getByRole('button', { name: 'Copy user ID' })
    fireEvent.click(button)
    expect(writeText).toHaveBeenCalledWith('user-123')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
