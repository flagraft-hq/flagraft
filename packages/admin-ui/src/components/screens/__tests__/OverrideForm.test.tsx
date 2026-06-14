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
  it('renders in add mode with title "New override" and "Save override" button', () => {
    render(<OverrideForm {...baseProps} />)
    expect(screen.getByText('New override')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save override/i })).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated values and "Save changes" button', () => {
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
    expect(screen.getByText('Edit override')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('user-123')).toBeInTheDocument()
    expect(screen.getByDisplayValue('VIP user')).toBeInTheDocument()
  })

  it('shows validation errors inline when validateOverrideForm returns errors', async () => {
    mockValidate.mockReturnValue({
      key: 'Context key is required',
      op: 'Operator is required',
      val: 'Value is required',
    })
    render(<OverrideForm {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /save override/i }))
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
    fireEvent.click(screen.getByRole('button', { name: /save override/i }))
    await waitFor(() => {
      expect(screen.getByText('Context key is required')).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with correct shape when form is valid (result defaults to ON)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockValidate.mockReturnValue({})
    render(<OverrideForm {...baseProps} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('When context key'), { target: { value: 'userId' } })
    fireEvent.change(screen.getByLabelText('matches'), { target: { value: 'equals' } })
    fireEvent.change(screen.getByLabelText('value'), { target: { value: 'user-abc' } })

    fireEvent.click(screen.getByRole('button', { name: /save override/i }))

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

  it('selecting OFF in the result control saves result=false', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockValidate.mockReturnValue({})
    render(<OverrideForm {...baseProps} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('When context key'), { target: { value: 'userId' } })
    fireEvent.change(screen.getByLabelText('matches'), { target: { value: 'equals' } })
    fireEvent.change(screen.getByLabelText('value'), { target: { value: 'user-abc' } })
    fireEvent.click(screen.getByRole('radio', { name: /^off$/i }))

    fireEvent.click(screen.getByRole('button', { name: /save override/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ result: false }))
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

    fireEvent.change(screen.getByLabelText('When context key'), { target: { value: 'beta' } })
    await waitFor(() => {
      const opSelect = screen.getByLabelText<HTMLSelectElement>('matches')
      const options = Array.from(opSelect.options)
        .map((o) => o.value)
        .filter(Boolean)
      expect(options).toEqual(['is'])
    })

    fireEvent.change(screen.getByLabelText('When context key'), { target: { value: 'userId' } })
    await waitFor(() => {
      const opSelect = screen.getByLabelText<HTMLSelectElement>('matches')
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

    fireEvent.change(screen.getByLabelText('When context key'), { target: { value: 'userId' } })
    fireEvent.change(screen.getByLabelText('matches'), { target: { value: 'equals' } })
    fireEvent.change(screen.getByLabelText('value'), { target: { value: 'user-abc' } })

    fireEvent.click(screen.getByRole('button', { name: /save override/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save override/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })

    resolvePromise!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save override/i })).not.toBeDisabled()
    })
  })
})
