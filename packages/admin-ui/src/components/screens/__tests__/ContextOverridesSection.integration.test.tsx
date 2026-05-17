import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextOverridesSection } from '../ContextOverridesSection'

vi.mock('../../../hooks/useOverrides')
vi.mock('../../../hooks/useContextFields')
vi.mock('../../../hooks/useRelativeDate', () => ({
  useRelativeDate: () => '1 day ago',
}))
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], push: vi.fn(), dismiss: vi.fn() }),
}))

import { useOverrides } from '../../../hooks/useOverrides'
import { useContextFields } from '../../../hooks/useContextFields'

const mockFields = [
  {
    key: 'userId',
    type: 'string' as const,
    source: 'sdk' as const,
    required: false,
    example: 'user_123',
    desc: 'User ID',
    usedIn: 5,
  },
  {
    key: 'plan',
    type: 'enum' as const,
    source: 'sdk' as const,
    required: false,
    example: 'pro',
    desc: 'Subscription plan',
    enumValues: ['free', 'pro', 'enterprise'],
    usedIn: 3,
  },
]

const mockOverrides = [
  {
    id: 'ov1',
    flag: 'my-flag',
    env: 'development',
    key: 'userId',
    op: 'equals',
    val: 'user_123',
    result: true,
    note: 'Test user',
    created: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ov2',
    flag: 'my-flag',
    env: 'development',
    key: 'plan',
    op: 'equals',
    val: 'pro',
    result: false,
    note: '',
    created: '2024-01-02T00:00:00Z',
  },
]

const mockCreateOverride = vi.fn()
const mockUpdateOverride = vi.fn()
const mockDeleteOverride = vi.fn()
const mockRefetch = vi.fn()

function setupMocks(overrides = mockOverrides) {
  mockCreateOverride.mockReset().mockResolvedValue(undefined)
  mockUpdateOverride.mockReset().mockResolvedValue(undefined)
  mockDeleteOverride.mockReset().mockResolvedValue(undefined)
  mockRefetch.mockReset()

  vi.mocked(useOverrides).mockReturnValue({
    overrides,
    loading: false,
    error: null,
    createOverride: mockCreateOverride,
    updateOverride: mockUpdateOverride,
    deleteOverride: mockDeleteOverride,
    refetch: mockRefetch,
  })
  vi.mocked(useContextFields).mockReturnValue({
    fields: mockFields,
    loading: false,
    error: null,
    getField: (key: string) => mockFields.find((f) => f.key === key),
  })
}

const defaultProps = {
  projectId: 'p1',
  flagKey: 'my-flag',
  env: 'development',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContextOverridesSection integration tests', () => {
  it('renders the full overrides list with real OverrideRow components', () => {
    setupMocks()
    render(<ContextOverridesSection {...defaultProps} />)

    expect(screen.getByText('userId')).toBeInTheDocument()
    expect(screen.getAllByText('equals').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('user_123')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('shows empty state when no overrides exist', () => {
    setupMocks([])
    render(<ContextOverridesSection {...defaultProps} />)

    expect(screen.getByText('No overrides yet')).toBeInTheDocument()
  })

  it('add override flow: form appears, submitting creates override', async () => {
    setupMocks([])
    render(<ContextOverridesSection {...defaultProps} />)

    // Click the Add Override button in the empty state
    const addButtons = screen.getAllByRole('button', { name: /add override/i })
    fireEvent.click(addButtons[0])

    // Form should appear
    expect(screen.getByRole('button', { name: /^Add$/i })).toBeInTheDocument()

    // Select context key = userId
    const keySelect = screen.getByLabelText('Context Key')
    fireEvent.change(keySelect, { target: { value: 'userId' } })

    // Select operator = equals
    const opSelect = screen.getByLabelText('Operator')
    fireEvent.change(opSelect, { target: { value: 'equals' } })

    // Type value
    const valInput = screen.getByLabelText('Value')
    fireEvent.change(valInput, { target: { value: 'user_456' } })

    // Result is already 'Enabled' (true) by default, but let's ensure
    const resultSelect = screen.getByLabelText('Result')
    fireEvent.change(resultSelect, { target: { value: 'true' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    await waitFor(() => {
      expect(mockCreateOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          env: 'development',
          key: 'userId',
          op: 'equals',
          val: 'user_456',
          result: true,
          note: '',
        }),
      )
    })
  })

  it('validation error shown when form submitted empty', async () => {
    setupMocks([])
    render(<ContextOverridesSection {...defaultProps} />)

    // Click "Add Override" button
    const addButtons = screen.getAllByRole('button', { name: /add override/i })
    fireEvent.click(addButtons[0])

    // Submit without filling anything
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    // Validation errors should appear
    await waitFor(() => {
      const errorTexts = screen.queryAllByText(/context key is required|operator is required/i)
      expect(errorTexts.length).toBeGreaterThan(0)
    })

    // createOverride should NOT have been called
    expect(mockCreateOverride).not.toHaveBeenCalled()
  })

  it('delete override flow: confirmation modal appears, confirming calls deleteOverride', async () => {
    setupMocks()
    render(<ContextOverridesSection {...defaultProps} />)

    // Click Delete button on the first override row
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    // First "Delete" button in the row (not the modal confirm)
    fireEvent.click(deleteButtons[0])

    // Confirmation modal should appear with userId key text
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // The modal body contains text about the key being deleted
      expect(screen.getByText(/delete override for/i)).toBeInTheDocument()
      expect(screen.getAllByText(/userId/).length).toBeGreaterThanOrEqual(1)
    })

    // Click the confirm Delete button in the modal (scoped to dialog)
    const dialog = screen.getByRole('dialog')
    const confirmDeleteButton = Array.from(dialog.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Delete',
    )
    expect(confirmDeleteButton).toBeTruthy()
    fireEvent.click(confirmDeleteButton!)

    await waitFor(() => {
      expect(mockDeleteOverride).toHaveBeenCalledWith('ov1')
    })
  })

  it('edit override flow: form pre-populated, saving calls updateOverride', async () => {
    setupMocks()
    render(<ContextOverridesSection {...defaultProps} />)

    // Click Edit button on the first override row
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    // Form should appear with pre-populated value
    await waitFor(() => {
      const valInput = screen.getByLabelText<HTMLInputElement>('Value')
      expect(valInput.value).toBe('user_123')
    })

    // Change value to user_999
    const valInput = screen.getByLabelText('Value')
    fireEvent.change(valInput, { target: { value: 'user_999' } })

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(mockUpdateOverride).toHaveBeenCalledWith(
        'ov1',
        expect.objectContaining({ val: 'user_999' }),
      )
    })
  })

  it('duplicate validation: shows error when identical override exists', async () => {
    setupMocks(mockOverrides)
    render(<ContextOverridesSection {...defaultProps} />)

    // Click header "Add Override" button
    fireEvent.click(screen.getByRole('button', { name: /add override/i }))

    // Fill: key=userId, op=equals, val=user_123 (same as mockOverrides[0])
    const keySelect = screen.getByLabelText('Context Key')
    fireEvent.change(keySelect, { target: { value: 'userId' } })

    const opSelect = screen.getByLabelText('Operator')
    fireEvent.change(opSelect, { target: { value: 'equals' } })

    const valInput = screen.getByLabelText('Value')
    fireEvent.change(valInput, { target: { value: 'user_123' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    // Duplicate error should appear
    await waitFor(() => {
      expect(screen.getByText(/an identical override already exists/i)).toBeInTheDocument()
    })

    // createOverride should NOT have been called
    expect(mockCreateOverride).not.toHaveBeenCalled()
  })
})
