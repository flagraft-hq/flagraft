import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OverrideForm } from '../OverrideForm'
import type { ContextField, Override } from '../../../lib/types'

vi.mock('../../../lib/validation', () => ({
  validateOverrideForm: vi.fn(),
}))

import { validateOverrideForm } from '../../../lib/validation'

const mockValidate = validateOverrideForm as ReturnType<typeof vi.fn>

const contextFields: ContextField[] = [
  {
    key: 'userId',
    type: 'string',
    source: 'sdk',
    required: true,
    example: 'user-123',
    desc: 'User ID',
    usedIn: 5,
  },
  {
    key: 'plan',
    type: 'enum',
    source: 'sdk',
    required: false,
    example: 'pro',
    desc: 'Subscription plan',
    enumValues: ['free', 'pro', 'enterprise'],
    usedIn: 3,
  },
  {
    key: 'beta',
    type: 'boolean',
    source: 'sdk',
    required: false,
    example: 'true',
    desc: 'Beta user flag',
    usedIn: 2,
  },
]

const existingOverrides: Override[] = []

const baseProps = {
  projectId: 'proj-1',
  flagKey: 'my-flag',
  env: 'production',
  contextFields,
  existingOverrides,
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockValidate.mockReturnValue({})
})

describe('OverrideForm', () => {
  it('renders in add mode with title "Add Override" and "Add" button', () => {
    render(<OverrideForm {...baseProps} />)
    expect(screen.getByText('Add Override')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated values and "Save" button', () => {
    const editingOverride: Override = {
      id: 'ov-1',
      flag: 'my-flag',
      env: 'production',
      key: 'userId',
      op: 'equals',
      val: 'user-123',
      result: true,
      note: 'VIP user',
      created: '2024-01-01',
    }
    render(<OverrideForm {...baseProps} editingOverride={editingOverride} />)
    expect(screen.getByText('Edit Override')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    // Value field should be pre-populated
    expect(screen.getByDisplayValue('user-123')).toBeInTheDocument()
    // Note field should be pre-populated
    expect(screen.getByDisplayValue('VIP user')).toBeInTheDocument()
  })

  it('shows validation errors inline when validateOverrideForm returns errors', async () => {
    mockValidate.mockReturnValue({
      key: 'Context key is required',
      op: 'Operator is required',
      val: 'Value is required',
    })
    render(<OverrideForm {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(screen.getByText('Context key is required')).toBeInTheDocument()
      expect(screen.getByText('Operator is required')).toBeInTheDocument()
      expect(screen.getByText('Value is required')).toBeInTheDocument()
    })
  })

  it('does not call onSave when there are validation errors', async () => {
    const onSave = vi.fn()
    mockValidate.mockReturnValue({ key: 'Context key is required' })
    render(<OverrideForm {...baseProps} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(screen.getByText('Context key is required')).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with correct shape when form is valid', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockValidate.mockReturnValue({})
    render(<OverrideForm {...baseProps} onSave={onSave} />)

    // Select context key
    const keySelect = screen.getByLabelText('Context Key')
    fireEvent.change(keySelect, { target: { value: 'userId' } })

    // Select operator
    const opSelect = screen.getByLabelText('Operator')
    fireEvent.change(opSelect, { target: { value: 'equals' } })

    // Fill in value
    const valInput = screen.getByLabelText('Value')
    fireEvent.change(valInput, { target: { value: 'user-abc' } })

    // Select result
    const resultSelect = screen.getByLabelText('Result')
    fireEvent.change(resultSelect, { target: { value: 'true' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          env: 'production',
          key: 'userId',
          op: 'equals',
          val: 'user-abc',
          result: true,
        }),
      )
    })
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<OverrideForm {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('operator options change based on selected context field type', async () => {
    render(<OverrideForm {...baseProps} />)

    // Select a boolean field - should offer only "is" operator
    const keySelect = screen.getByLabelText('Context Key')
    fireEvent.change(keySelect, { target: { value: 'beta' } })

    await waitFor(() => {
      const opSelect = screen.getByLabelText<HTMLSelectElement>('Operator')
      const options = Array.from(opSelect.options)
        .map((o) => o.value)
        .filter(Boolean)
      expect(options).toEqual(['is'])
    })

    // Switch to string field - should have more operators
    fireEvent.change(keySelect, { target: { value: 'userId' } })
    await waitFor(() => {
      const opSelect = screen.getByLabelText<HTMLSelectElement>('Operator')
      const options = Array.from(opSelect.options)
        .map((o) => o.value)
        .filter(Boolean)
      expect(options).toContain('equals')
      expect(options).toContain('contains')
    })
  })

  it('save button is disabled while save is in progress', async () => {
    let resolvePromise: () => void
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve
        }),
    )
    mockValidate.mockReturnValue({})
    render(<OverrideForm {...baseProps} onSave={onSave} />)

    // Select context key
    const keySelect = screen.getByLabelText('Context Key')
    fireEvent.change(keySelect, { target: { value: 'userId' } })

    // Select operator
    const opSelect = screen.getByLabelText('Operator')
    fireEvent.change(opSelect, { target: { value: 'equals' } })

    // Fill in value
    const valInput = screen.getByLabelText('Value')
    fireEvent.change(valInput, { target: { value: 'user-abc' } })

    // Select result
    const resultSelect = screen.getByLabelText('Result')
    fireEvent.change(resultSelect, { target: { value: 'true' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })

    // Resolve the save
    resolvePromise!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled()
    })
  })
})
