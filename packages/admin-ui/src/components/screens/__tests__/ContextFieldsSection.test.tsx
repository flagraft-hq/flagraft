import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextFieldsSection } from '../ContextFieldsSection'

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

vi.mock('../../../lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = 'ApiError'
    }
  }
  return {
    ApiError,
    contextFieldsApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { contextFieldsApi, ApiError } from '../../../lib/api'

const mockApi = contextFieldsApi as unknown as {
  list: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const fields = [
  {
    id: 'cf-1',
    key: 'plan',
    type: 'enum' as const,
    description: 'Subscription tier',
    enumValues: ['free', 'pro', 'enterprise', 'legacy'],
  },
  {
    id: 'cf-2',
    key: 'country',
    type: 'string' as const,
    description: null,
    enumValues: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.list.mockResolvedValue({ data: fields })
})

describe('ContextFieldsSection', () => {
  it('renders fields from the API with the first 3 enum chips', async () => {
    render(<ContextFieldsSection projectId="p1" />)
    expect(await screen.findByText('plan')).toBeInTheDocument()
    expect(screen.getByText('country')).toBeInTheDocument()
    // enum shows first 3 values plus a "+1" overflow
    expect(screen.getByText('free')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    expect(screen.getByText('enterprise')).toBeInTheDocument()
    expect(screen.queryByText('legacy')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('shows an inline empty state when there are no fields', async () => {
    mockApi.list.mockResolvedValue({ data: [] })
    render(<ContextFieldsSection projectId="p1" />)
    expect(await screen.findByText(/no context fields yet/i)).toBeInTheDocument()
  })

  it('add flow: opens dialog, submits, and refetches', async () => {
    const user = userEvent.setup()
    mockApi.create.mockResolvedValue({ data: {} })
    render(<ContextFieldsSection projectId="p1" />)
    await screen.findByText('plan')

    await user.click(screen.getByRole('button', { name: /add field/i }))
    expect(screen.getByText('New context field')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Key'), 'cohort')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^add field$/i }))

    await waitFor(() =>
      expect(mockApi.create).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ key: 'cohort', type: 'string' }),
      ),
    )
    // initial load + refetch after save
    await waitFor(() => expect(mockApi.list).toHaveBeenCalledTimes(2))
  })

  it('enum "Allowed values" input appears only when type is enum', async () => {
    const user = userEvent.setup()
    render(<ContextFieldsSection projectId="p1" />)
    await screen.findByText('plan')

    await user.click(screen.getByRole('button', { name: /add field/i }))
    expect(screen.queryByLabelText('Allowed values')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Type'), 'enum')
    expect(screen.getByLabelText('Allowed values')).toBeInTheDocument()
  })

  it('surfaces a 409 duplicate-key error inline', async () => {
    const user = userEvent.setup()
    mockApi.create.mockRejectedValue(
      new ApiError('A context field with this key already exists', 409),
    )
    render(<ContextFieldsSection projectId="p1" />)
    await screen.findByText('plan')

    await user.click(screen.getByRole('button', { name: /add field/i }))
    await user.type(screen.getByLabelText('Key'), 'plan')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^add field$/i }))

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
    // dialog stays open on error
    expect(screen.getByText('New context field')).toBeInTheDocument()
  })

  it('delete flow: confirm calls the API and refetches', async () => {
    const user = userEvent.setup()
    mockApi.delete.mockResolvedValue({ data: {} })
    render(<ContextFieldsSection projectId="p1" />)
    await screen.findByText('plan')

    await user.click(screen.getByRole('button', { name: 'Delete country' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete context field')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('p1', 'cf-2'))
    await waitFor(() => expect(mockApi.list).toHaveBeenCalledTimes(2))
  })
})
