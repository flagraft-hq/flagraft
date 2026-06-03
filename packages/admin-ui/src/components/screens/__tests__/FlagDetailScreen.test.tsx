import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FlagDetailScreen } from '../FlagDetailScreen'
import type { Flag } from '../../../lib/types'

vi.mock('../../../lib/api', () => ({
  flagsApi: {
    get: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
  ProjectContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  ProjectProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockToastPush = vi.fn()

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: mockToastPush }),
}))

vi.mock('../ContextOverridesSection', () => ({
  ContextOverridesSection: ({
    projectId,
    flagKey,
    env,
  }: {
    projectId: string
    flagKey: string
    env: string
  }) => (
    <div
      data-testid="mocked-overrides-section"
      data-project={projectId}
      data-flag={flagKey}
      data-env={env}
    />
  ),
}))

import { flagsApi } from '../../../lib/api'
import { useProject } from '../../../contexts/ProjectContext'

const mockFlagsApi = flagsApi as unknown as {
  get: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  toggle: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

const mockUseProject = useProject as ReturnType<typeof vi.fn>

const mockFlag: Flag = {
  key: 'my-flag',
  name: 'My Feature Flag',
  description: 'A test flag',
  tags: ['beta', 'web'],
  created: '2026-01-01T00:00:00Z',
  updated: '2026-05-01T00:00:00Z',
  state: {
    development: { on: true, overrides: 2 },
    staging: { on: false, overrides: 0 },
    production: { on: false, overrides: 1 },
  },
  author: 'k_abc123',
}

function renderScreen(flagKey = 'my-flag') {
  return render(
    <MemoryRouter initialEntries={[`/flags/${flagKey}`]}>
      <Routes>
        <Route path="/flags/:key" element={<FlagDetailScreen />} />
        <Route path="/flags" element={<div data-testid="flags-list-page">Flags list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const defaultProjectContext = {
  activeProject: { id: 'p1', name: 'Test Project', slug: 'test', flagCount: 5 },
  activeEnv: 'development',
  setActiveEnv: vi.fn(),
  projects: [],
  loading: false,
  error: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFlagsApi.get.mockResolvedValue({ data: mockFlag })
  mockFlagsApi.delete.mockResolvedValue({})
  mockFlagsApi.toggle.mockResolvedValue({})
  mockUseProject.mockReturnValue(defaultProjectContext)
})

describe('FlagDetailScreen', () => {
  it('shows loading state initially', () => {
    mockFlagsApi.get.mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders flag name in header after load', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'My Feature Flag' })).toBeInTheDocument()
    })
  })

  it('renders flag key chip', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('my-flag')).toBeInTheDocument()
    })
  })

  it('renders all three tabs', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /environments/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /usage/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument()
    })
  })

  it('switches to usage tab when Usage tab is clicked', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /usage/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('tab', { name: /usage/i }))
    expect(screen.getByText(/usage data coming soon/i)).toBeInTheDocument()
  })

  it('opens delete confirm modal when Delete is clicked', async () => {
    renderScreen()
    const deleteButton = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(/delete flag/i)
  })

  it('confirming delete navigates back to /flags and shows success toast', async () => {
    renderScreen()
    const deleteButton = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)
    const modal = screen.getByRole('dialog')
    const confirmBtn = within(modal).getByRole('button', { name: /^delete$/i })
    fireEvent.click(confirmBtn)
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flag deleted', variant: 'success' }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('flags-list-page')).toBeInTheDocument(),
    )
  })

  it('cancelling delete closes the modal and stays on the detail page', async () => {
    renderScreen()
    const deleteButton = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByTestId('flags-list-page')).not.toBeInTheDocument()
    expect(mockFlagsApi.delete).not.toHaveBeenCalled()
  })

  it('Copy key button shows "Key copied" success toast', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    renderScreen()
    const copyBtn = await screen.findByRole('button', { name: /copy key/i })
    fireEvent.click(copyBtn)
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Key copied', variant: 'success' }),
    )
  })

  it('History tab shows "coming soon" placeholder', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: /history/i }))
    expect(screen.getByText(/history coming soon/i)).toBeInTheDocument()
  })

  it('Environments tab shows a card per environment with enabled/disabled state', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0))
    // development is on, staging and production are off
    expect(screen.getAllByText('Enabled').length).toBe(1)
    expect(screen.getAllByText('Disabled').length).toBe(2)
  })

  it('toggling an environment calls flagsApi.toggle and shows a success toast', async () => {
    const user = userEvent.setup()
    mockFlagsApi.toggle.mockResolvedValue({})
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    // development is on (index 0) — clicking disables it
    await user.click(switches[0])
    await waitFor(() =>
      expect(mockFlagsApi.toggle).toHaveBeenCalledWith('p1', 'my-flag', 'development', false),
    )
    await waitFor(() =>
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'development toggled', variant: 'success' }),
      ),
    )
  })

  it('no project state shows "No project selected"', () => {
    mockUseProject.mockReturnValueOnce({
      activeProject: null,
      activeEnv: 'development',
      setActiveEnv: vi.fn(),
      projects: [],
      loading: false,
      error: null,
    })
    renderScreen()
    expect(screen.getByText('No project selected')).toBeInTheDocument()
  })

  it('clicking the production env toggle shows a confirmation before enabling', async () => {
    const user = userEvent.setup()
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    // production is at index 2 (dev=0, staging=1, production=2); it starts off (checked=false)
    await user.click(switches[2])
    expect(mockFlagsApi.toggle).not.toHaveBeenCalled()
    expect(screen.getByText(/enable production toggle/i)).toBeInTheDocument()
  })

  it('confirming the production toggle calls flagsApi.toggle', async () => {
    const user = userEvent.setup()
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    await user.click(switches[2])
    // confirmation UI is now visible; click the Yes button to confirm
    await user.click(screen.getByRole('button', { name: /^yes$/i }))
    await waitFor(() =>
      expect(mockFlagsApi.toggle).toHaveBeenCalledWith('p1', 'my-flag', 'production', true),
    )
  })

  it('disabling production toggle fires immediately without confirmation', async () => {
    const user = userEvent.setup()
    // Override the flag so production starts enabled (on: true)
    const productionOnFlag: Flag = {
      ...mockFlag,
      state: {
        ...mockFlag.state,
        production: { on: true, overrides: 1 },
      },
    }
    mockFlagsApi.get.mockResolvedValue({ data: productionOnFlag })
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    // production is at index 2; it is now on (checked=true), so clicking disables immediately
    await user.click(switches[2])
    await waitFor(() =>
      expect(mockFlagsApi.toggle).toHaveBeenCalledWith('p1', 'my-flag', 'production', false),
    )
    expect(screen.queryByText(/enable production toggle/i)).not.toBeInTheDocument()
  })
})

describe('ContextOverridesSection integration', () => {
  it('renders ContextOverridesSection in environments tab', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByTestId('mocked-overrides-section')).toBeInTheDocument()
    })
  })

  it('passes correct props to ContextOverridesSection', async () => {
    renderScreen()
    const section = await screen.findByTestId('mocked-overrides-section')
    expect(section).toHaveAttribute('data-project', 'p1')
    expect(section).toHaveAttribute('data-flag', 'my-flag')
    expect(section).toHaveAttribute('data-env', 'development')
  })

  it('ContextOverridesSection not rendered in Usage tab', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /usage/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('tab', { name: /usage/i }))
    expect(screen.queryByTestId('mocked-overrides-section')).not.toBeInTheDocument()
  })
})

describe('Edit flag modal', () => {
  it('opens edit modal when Edit button is clicked', async () => {
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit flag')).toBeInTheDocument()
  })

  it('pre-populates name and description fields from flag data', async () => {
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    const nameInput = screen.getByRole('textbox', { name: /name/i })
    const descInput = screen.getByRole('textbox', { name: /description/i })
    expect(nameInput).toHaveValue(mockFlag.name)
    expect(descInput).toHaveValue(mockFlag.description)
  })

  it('calls flagsApi.update with edited values on Save', async () => {
    mockFlagsApi.update.mockResolvedValue({ data: { ...mockFlag, name: 'Updated Name' } })
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    const nameInput = screen.getByRole('textbox', { name: /name/i })
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveButton)
    await waitFor(() => {
      expect(mockFlagsApi.update).toHaveBeenCalledWith('p1', mockFlag.key, {
        name: 'Updated Name',
        description: mockFlag.description,
      })
    })
  })

  it('shows success toast and closes modal on successful save', async () => {
    mockFlagsApi.update.mockResolvedValue({ data: { ...mockFlag, name: 'Updated' } })
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveButton)
    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Flag updated', variant: 'success' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('cancelling edit closes the modal without calling update', async () => {
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockFlagsApi.update).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My Feature Flag' })).toBeInTheDocument()
  })

  it('keeps modal open on save error', async () => {
    mockFlagsApi.update.mockRejectedValue(new Error('Network error'))
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveButton)
    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith({ title: 'Network error', variant: 'error' })
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('after save, the detail page heading updates to the new flag name', async () => {
    mockFlagsApi.update.mockResolvedValue({ data: { ...mockFlag, name: 'Updated Name' } })
    const user = userEvent.setup()
    renderScreen()
    const editButton = await screen.findByRole('button', { name: /edit/i })
    await user.click(editButton)
    const nameInput = screen.getByRole('textbox', { name: /name/i })
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Updated Name' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: 'My Feature Flag' })).not.toBeInTheDocument()
  })
})
