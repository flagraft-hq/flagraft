import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlagBulkActionBar } from '../FlagBulkActionBar'

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
  environments: [],
  refetchEnvironments: vi.fn(),
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

describe('FlagBulkActionBar', () => {
  it('returns null when selectedKeys is empty', () => {
    const { container } = render(<FlagBulkActionBar {...defaultProps} selectedKeys={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows count of selected flags when selectedKeys has items', () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    /** Count and label are separate spans inside the shared BulkBar shell. */
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('selected')).toBeInTheDocument()
  })

  it('renders Enable All, Disable All, and Delete buttons', () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Enable All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('clicking Enable All calls flagsApi.toggle for each key with enabled=true and calls onDone', async () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }))
    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledTimes(2)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-a', 'development', true)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-b', 'development', true)
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('clicking Disable All calls flagsApi.toggle for each key with enabled=false and calls onDone', async () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }))
    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledTimes(2)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-a', 'development', false)
      expect(mockToggle).toHaveBeenCalledWith('proj-1', 'flag-b', 'development', false)
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('clicking Delete shows a confirmation modal', () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 2 flags?')).toBeInTheDocument()
  })

  it('uses singular wording when a single flag is selected', () => {
    render(<FlagBulkActionBar {...defaultProps} selectedKeys={['flag-a']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this flag?')).toBeInTheDocument()
  })

  it('confirming delete calls flagsApi.delete for each key, shows a toast, and calls onDone', async () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete flags' }))
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(2)
      expect(mockDelete).toHaveBeenCalledWith('proj-1', 'flag-a')
      expect(mockDelete).toHaveBeenCalledWith('proj-1', 'flag-b')
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
    })
    expect(mockToastPush).toHaveBeenCalledWith({ title: '2 flags deleted', variant: 'success' })
  })

  it('shows an error toast and keeps the modal open when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('boom'))
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete flags' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({
        title: 'Failed to delete flags',
        msg: 'boom',
        variant: 'error',
      }),
    )
    expect(screen.getByText('Delete 2 flags?')).toBeInTheDocument()
    expect(defaultProps.onDone).not.toHaveBeenCalled()
  })

  it('shows an error toast when Enable All fails', async () => {
    mockToggle.mockRejectedValue(new Error('boom'))
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({
        title: 'Failed to enable flags',
        msg: 'boom',
        variant: 'error',
      }),
    )
    expect(defaultProps.onDone).not.toHaveBeenCalled()
  })

  it('canceling delete hides the modal without calling flagsApi.delete', async () => {
    render(<FlagBulkActionBar {...defaultProps} />)
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
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flags enabled', variant: 'success' }),
    )
  })

  it('clicking Disable All shows a success toast', async () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }))
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flags disabled', variant: 'success' }),
    )
  })

  it('clicking the X button calls onCancel', () => {
    render(<FlagBulkActionBar {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('X button does not render when onCancel is not provided', () => {
    render(
      <FlagBulkActionBar selectedKeys={['a']} projectId="p" activeEnv="dev" onDone={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /clear selection/i })).not.toBeInTheDocument()
  })
})
