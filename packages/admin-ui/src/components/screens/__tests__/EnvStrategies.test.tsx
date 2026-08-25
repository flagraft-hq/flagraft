import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnvStrategies } from '../EnvStrategies'
import type { ContextField } from '../../../lib/types'

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
    strategiesApi: { list: vi.fn(), replace: vi.fn() },
  }
})

import { strategiesApi } from '../../../lib/api'

const mockApi = strategiesApi as unknown as {
  list: ReturnType<typeof vi.fn>
  replace: ReturnType<typeof vi.fn>
}

const contextFields: ContextField[] = [
  { id: 'cf1', key: 'tenant', type: 'string', description: null, enumValues: null },
]

function renderIt() {
  return render(
    <EnvStrategies projectId="p1" flagKey="lobby" env="production" contextFields={contextFields} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.list.mockResolvedValue({ data: [] })
})

describe('EnvStrategies', () => {
  it('shows the on-for-everyone state when there are no strategies', async () => {
    renderIt()
    expect(await screen.findByText(/No targeting rules — default value applies/i)).toBeInTheDocument()
  })

  it('renders a summary of rules and fields for existing strategies', async () => {
    mockApi.list.mockResolvedValue({
      data: [
        {
          id: 's1',
          position: 0,
          constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg', 'hell'] }],
        },
      ],
    })
    renderIt()
    expect(await screen.findByText(/1 targeting rule · tenant/i)).toBeInTheDocument()
  })

  it('edit flow: add a strategy + condition, save, and refetch', async () => {
    const user = userEvent.setup()
    mockApi.replace.mockResolvedValue({ data: [] })
    renderIt()
    await screen.findByText(/No targeting rules/i)

    await user.click(screen.getByRole('button', { name: /add rule/i }))
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /add strategy/i }))
    await user.click(within(dialog).getByRole('button', { name: /add condition/i }))
    await user.type(within(dialog).getByPlaceholderText(/type and press/i), 'phyg{enter}')
    await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

    await waitFor(() =>
      expect(mockApi.replace).toHaveBeenCalledWith('p1', 'lobby', 'production', [
        { constraints: [{ fieldKey: 'tenant', operator: 'equals', values: ['phyg'] }] },
      ]),
    )
    await waitFor(() => expect(mockApi.list).toHaveBeenCalledTimes(2))
  })

  it('shows an inline error when a constraint is incomplete', async () => {
    const user = userEvent.setup()
    renderIt()
    await screen.findByText(/No targeting rules/i)

    await user.click(screen.getByRole('button', { name: /add rule/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /add strategy/i }))
    await user.click(within(dialog).getByRole('button', { name: /add condition/i }))
    // leave value empty
    await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

    expect(await screen.findByText(/every constraint needs a field/i)).toBeInTheDocument()
    expect(mockApi.replace).not.toHaveBeenCalled()
  })
})
