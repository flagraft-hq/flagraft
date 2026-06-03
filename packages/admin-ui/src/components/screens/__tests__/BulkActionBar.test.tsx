import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BulkActionBar } from '../BulkActionBar'

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), toasts: [] }),
}))

vi.mock('../../../lib/api', () => ({
  flagsApi: {
    toggle: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import { flagsApi } from '../../../lib/api'

const mockToggle = flagsApi.toggle as ReturnType<typeof vi.fn>
const mockDelete = flagsApi.delete as ReturnType<typeof vi.fn>

const defaultProps = {
  selectedKeys: ['flag-a', 'flag-b'],
  projectId: 'proj-1',
  activeEnv: 'development',
  onDone: vi.fn(),
  onCancel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockToggle.mockResolvedValue({ data: {} })
  mockDelete.mockResolvedValue({ data: {} })
  mockToastPush.mockClear()
  defaultProps.onDone = vi.fn()
  defaultProps.onCancel = vi.fn()
})

describe('BulkActionBar', () => {
  it('returns null when selectedKeys is empty', () => {
    const { container } = render(<BulkActionBar {...defaultProps} selectedKeys={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows count of selected flags when selectedKeys has items', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('renders Enable All, Disable All, and Delete buttons', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Enable All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('clicking Enable All calls flagsApi.toggle for each key with enabled=true and calls onDone', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }))
    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledTimes(2)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-a', 'development', true)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-b', 'development', true)
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('clicking Disable All calls flagsApi.toggle for each key with enabled=false and calls onDone', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }))
    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledTimes(2)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-a', 'development', false)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-b', 'development', false)
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('clicking Delete shows a confirmation modal', () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 2 flags?')).toBeInTheDocument()
  })

  it('confirming delete calls flagsApi.delete for each key and calls onDone', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(2)
      expect(mockDelete).toHaveBeenCalledWith('proj-1', 'flag-a')
      expect(mockDelete).toHaveBeenCalledWith('proj-1', 'flag-b')
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('canceling delete hides the modal without calling flagsApi.delete', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 2 flags?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByText('Delete 2 flags?')).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
    expect(defaultProps.onDone).not.toHaveBeenCalled()
  })

  it('clicking Enable All shows a success toast', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flags enabled', variant: 'success' }),
    )
  })

  it('clicking Disable All shows a success toast', async () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flags disabled', variant: 'success' }),
    )
  })

  it('clicking the X button calls onCancel', () => {
    render(<BulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('X button does not render when onCancel is not provided', () => {
    render(
      <BulkActionBar selectedKeys={['a']} projectId="p" activeEnv="dev" onDone={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /clear selection/i })).not.toBeInTheDocument()
  })
})
