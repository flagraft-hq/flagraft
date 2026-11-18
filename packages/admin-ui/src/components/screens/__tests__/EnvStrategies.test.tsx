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
    expect(
      await screen.findByText(/No targeting rules — default value applies/i),
    ).toBeInTheDocument()
  })

  it('renders a summary of rules and fields for existing strategies', async () => {
    mockApi.list.mockResolvedValue({
      data: [
        {
          id: 's1',
          position: 0,
          constraints: [{ fieldKey: 'tenant', operator: 'in', values: ['phyg', 'hell'] }],
          variants: [],
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
        {
          constraints: [{ fieldKey: 'tenant', operator: 'equals', values: ['phyg'] }],
          variants: [],
        },
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

  describe('variants', () => {
    const variant = (name: string, weight: number, weightType = 'variable') => ({
      name,
      weight,
      weightType,
      stickiness: 'default',
    })

    async function openEditorWithStrategy() {
      const user = userEvent.setup()
      mockApi.replace.mockResolvedValue({ data: [] })
      renderIt()
      await screen.findByText(/No targeting rules/i)
      await user.click(screen.getByRole('button', { name: /add rule/i }))
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /add strategy/i }))
      return { user, dialog }
    }

    function savedVariants() {
      const strategies = mockApi.replace.mock.calls[0][3] as { variants: unknown[] }[]
      return strategies[0].variants
    }

    it('summarises variants and their split', async () => {
      mockApi.list.mockResolvedValue({
        data: [
          {
            id: 's1',
            position: 0,
            constraints: [],
            variants: [variant('a', 500), variant('b', 500)],
          },
        ],
      })
      renderIt()
      expect(await screen.findByText(/a 50%, b 50%/)).toBeInTheDocument()
    })

    it('saves two variants as an even split with default stickiness', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.type(within(dialog).getByLabelText('Variant 2 name'), 'b')

      expect(within(dialog).getByLabelText('Variant 1 weight')).toHaveValue('50')
      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

      await waitFor(() => expect(mockApi.replace).toHaveBeenCalled())
      expect(savedVariants()).toEqual([
        { name: 'a', weightType: 'variable', stickiness: 'default' },
        { name: 'b', weightType: 'variable', stickiness: 'default' },
      ])
    })

    it('a fixed weight leaves the rest to the other variant', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.type(within(dialog).getByLabelText('Variant 2 name'), 'b')

      await user.click(within(dialog).getByLabelText('Variant 1 fixed weight'))
      const weight = within(dialog).getByLabelText('Variant 1 weight')
      await user.clear(weight)
      await user.type(weight, '10')
      expect(within(dialog).getByLabelText('Variant 2 weight')).toHaveValue('90')

      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))
      await waitFor(() => expect(mockApi.replace).toHaveBeenCalled())
      expect(savedVariants()).toEqual([
        { name: 'a', weightType: 'fix', weight: 100, stickiness: 'default' },
        { name: 'b', weightType: 'variable', stickiness: 'default' },
      ])
    })

    it('sends the chosen stickiness and payload', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.selectOptions(within(dialog).getByLabelText('Stickiness'), 'tenant')
      await user.selectOptions(within(dialog).getByLabelText('Variant 1 payload type'), 'string')
      await user.type(within(dialog).getByLabelText('Variant 1 payload'), 'blue')

      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))
      await waitFor(() => expect(mockApi.replace).toHaveBeenCalled())
      expect(savedVariants()).toEqual([
        {
          name: 'a',
          weightType: 'variable',
          stickiness: 'tenant',
          payload: { type: 'string', value: 'blue' },
        },
      ])
    })

    it('loads existing variants into the editor', async () => {
      const user = userEvent.setup()
      mockApi.list.mockResolvedValue({
        data: [
          {
            id: 's1',
            position: 0,
            constraints: [],
            variants: [variant('a', 100, 'fix'), variant('b', 900)],
          },
        ],
      })
      renderIt()
      await screen.findByText(/a 10%, b 90%/)
      await user.click(screen.getByRole('button', { name: /add rule/i }))
      const dialog = screen.getByRole('dialog')

      expect(within(dialog).getByLabelText('Variant 1 name')).toHaveValue('a')
      expect(within(dialog).getByLabelText('Variant 1 fixed weight')).toBeChecked()
      expect(within(dialog).getByLabelText('Variant 1 weight')).toHaveValue('10')
      expect(within(dialog).getByLabelText('Variant 2 weight')).toHaveValue('90')
    })

    it('blocks saving a variant without a name', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

      expect(await screen.findByText(/every variant needs a name/i)).toBeInTheDocument()
      expect(mockApi.replace).not.toHaveBeenCalled()
    })

    it('blocks saving fixed weights that go over 100%', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.click(within(dialog).getByLabelText('Variant 1 fixed weight'))
      const weight = within(dialog).getByLabelText('Variant 1 weight')
      await user.clear(weight)
      await user.type(weight, '40')
      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

      expect(await screen.findByText(/fixed weights must add up to 100%/i)).toBeInTheDocument()
      expect(mockApi.replace).not.toHaveBeenCalled()
    })

    it('editing a condition keeps the variants', async () => {
      const { user, dialog } = await openEditorWithStrategy()
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.click(within(dialog).getByRole('button', { name: /add condition/i }))
      await user.type(within(dialog).getByPlaceholderText(/type and press/i), 'phyg{enter}')

      expect(within(dialog).getByLabelText('Variant 1 name')).toHaveValue('a')
    })

    it('shows the server message when saving fails', async () => {
      const { ApiError } = await import('../../../lib/api')
      const { user, dialog } = await openEditorWithStrategy()
      mockApi.replace.mockRejectedValue(new ApiError('Duplicate variant name: "a"', 400))
      await user.click(within(dialog).getByRole('button', { name: /add variant/i }))
      await user.type(within(dialog).getByLabelText('Variant 1 name'), 'a')
      await user.click(within(dialog).getByRole('button', { name: /save strategies/i }))

      expect(await screen.findByText(/duplicate variant name/i)).toBeInTheDocument()
    })
  })
})
