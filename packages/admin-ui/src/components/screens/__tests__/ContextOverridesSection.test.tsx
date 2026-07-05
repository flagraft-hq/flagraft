import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextOverridesSection } from '../ContextOverridesSection'

vi.mock('../../../hooks/useOverrides')
vi.mock('../../../hooks/useContextFields')

const mockToastPush = vi.fn()
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], push: mockToastPush, dismiss: vi.fn() }),
}))

vi.mock('../OverrideRow', () => ({
  OverrideRow: ({
    override,
    onEdit,
    onDelete,
  }: {
    override: Override
    onEdit: (override: Override) => void
    onDelete: (id: string) => void
  }) => (
    <div data-testid={`row-${override.id}`}>
      <button onClick={() => onEdit(override)}>edit-{override.id}</button>
      <button onClick={() => onDelete(override.id)}>delete-{override.id}</button>
    </div>
  ),
}))

vi.mock('../OverrideForm', () => ({
  OverrideForm: ({
    onSave,
    onCancel,
    editingOverride,
  }: {
    onSave: (data: Omit<Override, 'id' | 'flag' | 'created'>) => Promise<void>
    onCancel: () => void
    editingOverride: Override | null
  }) => (
    <div data-testid="override-form">
      {editingOverride && <span data-testid="editing-id">{editingOverride.id}</span>}
      <button
        onClick={() => {
          void onSave({
            key: 'x',
            op: 'equals',
            val: 'y',
            result: true,
            note: '',
            env: 'development',
          })
        }}
      >
        submit
      </button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}))

vi.mock('../OverridesEmptyState', () => ({
  OverridesEmptyState: ({ onAdd }: { onAdd: () => void }) => (
    <button data-testid="empty-add" onClick={onAdd}>
      add
    </button>
  ),
}))

import { useOverrides } from '../../../hooks/useOverrides'
import { useContextFields } from '../../../hooks/useContextFields'
import type { Override } from '../../../lib/types'

const mockUseOverrides = useOverrides as ReturnType<typeof vi.fn>
const mockUseContextFields = useContextFields as ReturnType<typeof vi.fn>

const mockOverride1 = {
  id: 'o1',
  flag: 'my-flag',
  env: 'development',
  key: 'userId',
  op: 'equals',
  val: 'alice',
  result: true,
  note: '',
  created: '2024-01-01T00:00:00Z',
}

const mockOverride2 = {
  id: 'o2',
  flag: 'my-flag',
  env: 'development',
  key: 'plan',
  op: 'equals',
  val: 'pro',
  result: false,
  note: '',
  created: '2024-01-02T00:00:00Z',
}

const defaultProps = {
  projectId: 'proj1',
  flagKey: 'my-flag',
  env: 'development',
}

function makeHookResult(overrides: Override[], loading = false, error: string | null = null) {
  return {
    overrides,
    loading,
    error,
    createOverride: vi.fn().mockResolvedValue(undefined),
    updateOverride: vi.fn().mockResolvedValue(undefined),
    deleteOverride: vi.fn().mockResolvedValue(undefined),
    refetch: vi.fn(),
  }
}

beforeEach(() => {
  mockToastPush.mockClear()
  mockUseContextFields.mockReturnValue({
    fields: [],
    loading: false,
    error: null,
    getField: vi.fn(),
  })
})

describe('ContextOverridesSection', () => {
  it('shows loading indicator when loading=true', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([], true))
    render(<ContextOverridesSection {...defaultProps} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error when error is set', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([], false, 'Failed to load'))
    render(<ContextOverridesSection {...defaultProps} />)
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('shows empty state when overrides=[] and loading=false', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([], false))
    render(<ContextOverridesSection {...defaultProps} />)
    expect(screen.getByTestId('empty-add')).toBeInTheDocument()
  })

  it('renders env tabs by their name from the data, not the slug', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([], false))
    // Names come from the env data — the test is bound to those values, not literals.
    const dev = { slug: 'development', name: 'Renamed Dev', defaultOn: true, count: 0 }
    const prod = { slug: 'production', name: 'Renamed Prod', defaultOn: false, count: 0 }
    render(<ContextOverridesSection {...defaultProps} environments={[dev, prod]} />)
    expect(screen.getByRole('tab', { name: new RegExp(dev.name) })).toBeTruthy()
    expect(screen.getByRole('tab', { name: new RegExp(prod.name) })).toBeTruthy()
  })

  it('renders OverrideRow for each override', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([mockOverride1, mockOverride2]))
    render(<ContextOverridesSection {...defaultProps} />)
    expect(screen.getByTestId('row-o1')).toBeInTheDocument()
    expect(screen.getByTestId('row-o2')).toBeInTheDocument()
  })

  it('clicking "Add Override" header button shows the form', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([mockOverride1]))
    render(<ContextOverridesSection {...defaultProps} />)
    expect(screen.queryByTestId('override-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add override/i }))
    expect(screen.getByTestId('override-form')).toBeInTheDocument()
  })

  it('empty state add button shows the form', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([], false))
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByTestId('empty-add'))
    expect(screen.getByTestId('override-form')).toBeInTheDocument()
  })

  it('OverrideForm onSave calls createOverride and hides form', async () => {
    const hookResult = makeHookResult([mockOverride1])
    mockUseOverrides.mockReturnValue(hookResult)
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add override/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(hookResult.createOverride).toHaveBeenCalled()
      expect(screen.queryByTestId('override-form')).not.toBeInTheDocument()
    })
  })

  it('clicking edit on a row shows form with editingOverride set', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([mockOverride1]))
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit-o1' }))
    expect(screen.getByTestId('override-form')).toBeInTheDocument()
    expect(screen.getByTestId('editing-id')).toHaveTextContent('o1')
  })

  it('OverrideForm onSave in edit mode calls updateOverride (not createOverride)', async () => {
    const hookResult = makeHookResult([mockOverride1])
    mockUseOverrides.mockReturnValue(hookResult)
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit-o1' }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(hookResult.updateOverride).toHaveBeenCalledWith(
        'o1',
        expect.objectContaining({ key: 'x' }),
      )
      expect(hookResult.createOverride).not.toHaveBeenCalled()
      expect(screen.queryByTestId('override-form')).not.toBeInTheDocument()
    })
  })

  it('OverrideForm onCancel hides the form', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([mockOverride1]))
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add override/i }))
    expect(screen.getByTestId('override-form')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('override-form')).not.toBeInTheDocument()
  })

  it('clicking delete button shows confirmation modal', () => {
    mockUseOverrides.mockReturnValue(makeHookResult([mockOverride1]))
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'delete-o1' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/delete override for/i)).toBeInTheDocument()
  })

  it('confirming delete calls deleteOverride with the correct id', async () => {
    const hookResult = makeHookResult([mockOverride1])
    mockUseOverrides.mockReturnValue(hookResult)
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'delete-o1' }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => {
      expect(hookResult.deleteOverride).toHaveBeenCalledWith('o1')
    })
  })

  it('canceling delete does NOT call deleteOverride', () => {
    const hookResult = makeHookResult([mockOverride1])
    mockUseOverrides.mockReturnValue(hookResult)
    render(<ContextOverridesSection {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'delete-o1' }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(hookResult.deleteOverride).not.toHaveBeenCalled()
  })
})
