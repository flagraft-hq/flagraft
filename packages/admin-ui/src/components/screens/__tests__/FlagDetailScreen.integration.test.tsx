import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'
import type { AxiosResponse } from 'axios'
import { FlagDetailScreen } from '../FlagDetailScreen'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { ToastProvider } from '../../../contexts/ToastContext'
import type { Flag, Override, ContextField } from '../../../lib/types'

vi.mock('../../../lib/api', () => ({
  flagsApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
  },
  overridesApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  contextFieldsApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'proj-1', name: 'Test Project', slug: 'test', flagCount: 10 },
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    loading: false,
    error: null,
  }),
  ProjectContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  ProjectProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { flagsApi, overridesApi, contextFieldsApi } from '../../../lib/api'

const integrationFlag = {
  key: 'checkout-web',
  name: 'Checkout Web Redesign',
  description: 'Redesign of the checkout flow',
  tags: ['payments', 'web'],
  created: '2026-01-15T10:00:00Z',
  updated: '2026-04-20T08:30:00Z',
  state: {
    development: { on: true, overrides: 3 },
    staging: { on: true, overrides: 1 },
    production: { on: false, overrides: 0 },
  },
  author: 'k_abc',
}

function renderFlagDetail(initialPath = '/flags/checkout-web') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/flags/:key" element={<FlagDetailScreen />} />
            <Route path="/flags" element={<div data-testid="flags-list-page">Flags List</div>} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(flagsApi.get).mockResolvedValue({
    data: integrationFlag,
  } as unknown as AxiosResponse<Flag>)
  vi.mocked(overridesApi.list).mockResolvedValue({ data: [] } as unknown as AxiosResponse<
    Override[]
  >)
  vi.mocked(contextFieldsApi.list).mockResolvedValue({ data: [] } as unknown as AxiosResponse<
    ContextField[]
  >)
})

describe('FlagDetailScreen integration', () => {
  it('renders full flag detail with all major sections visible', async () => {
    renderFlagDetail()

    const heading = await screen.findByRole('heading', { name: 'Checkout Web Redesign' })
    expect(heading.tagName).toBe('H1')

    expect(screen.getByText('checkout-web')).toBeInTheDocument()

    expect(screen.getByRole('tab', { name: /environments/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /usage/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument()

    expect(screen.getByText('development')).toBeInTheDocument()
    expect(screen.getByText('staging')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('environments tab shows correct toggle states from flag data', async () => {
    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    const envCards = screen.getAllByText(/Enabled|Disabled/)
    const enabledCards = envCards.filter((el) => el.textContent === 'Enabled')
    const disabledCards = envCards.filter((el) => el.textContent === 'Disabled')

    expect(enabledCards.length).toBeGreaterThanOrEqual(1)
    expect(disabledCards.length).toBeGreaterThanOrEqual(1)
  })

  it('switching to Usage tab hides env cards and shows placeholder', async () => {
    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    expect(screen.getByText('development')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /usage/i }))

    expect(screen.queryByText('development')).not.toBeInTheDocument()
    expect(screen.getByText(/usage data coming soon/i)).toBeInTheDocument()
  })

  it('switching to History tab shows history placeholder', async () => {
    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    fireEvent.click(screen.getByRole('tab', { name: /history/i }))

    expect(screen.getByText(/history coming soon/i)).toBeInTheDocument()
  })

  it('ContextOverridesSection empty state renders in environments tab', async () => {
    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    await waitFor(() => {
      const addOverrideButtons = screen.getAllByRole('button', { name: /add override/i })
      expect(addOverrideButtons.length).toBeGreaterThan(0)
    })

    expect(screen.getByText(/no overrides yet/i)).toBeInTheDocument()
  })

  it('edit modal full flow: open, edit, save, flag name updates in header', async () => {
    vi.mocked(flagsApi.update).mockResolvedValue({
      data: { ...integrationFlag, name: 'Updated Checkout' },
    } as unknown as AxiosResponse<Flag>)

    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const nameInput = screen.getByRole('textbox', { name: /name/i })
    fireEvent.change(nameInput, { target: { value: 'Updated Checkout' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Updated Checkout' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('delete modal full flow: open, confirm, navigate away', async () => {
    vi.mocked(flagsApi.delete).mockResolvedValue({} as unknown as AxiosResponse<unknown>)

    renderFlagDetail()

    await screen.findByRole('heading', { name: 'Checkout Web Redesign' })

    const deleteButton = screen.getByRole('button', { name: /^delete$/i })
    fireEvent.click(deleteButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(/delete flag/i)

    const dialogDeleteButton = within(screen.getByRole('dialog')).getByRole('button', {
      name: /^delete$/i,
    })
    fireEvent.click(dialogDeleteButton)

    await waitFor(() => {
      expect(screen.getByTestId('flags-list-page')).toBeInTheDocument()
    })
  })
})
