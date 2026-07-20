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
    development: { on: true },
    staging: { on: false },
    production: { on: false },
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
  environments: [],
  refetchEnvironments: vi.fn(),
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
  it('navigates back to the flags list when the active project changes', async () => {
    const { rerender } = renderScreen()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'My Feature Flag' })).toBeInTheDocument()
    })

    mockUseProject.mockReturnValue({
      ...defaultProjectContext,
      activeProject: { id: 'p2', name: 'Other Project', slug: 'other', flagCount: 0 },
    })
    rerender(
      <MemoryRouter initialEntries={['/flags/my-flag']}>
        <Routes>
          <Route path="/flags/:key" element={<FlagDetailScreen />} />
          <Route path="/flags" element={<div data-testid="flags-list-page">Flags list</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('flags-list-page')).toBeInTheDocument()
    })
  })

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
    await waitFor(() => expect(screen.getByTestId('flags-list-page')).toBeInTheDocument())
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

  it('Copy key button copies the key and shows inline "Copied" feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderScreen()
    const copyBtn = await screen.findByRole('button', { name: /copy key/i })
    fireEvent.click(copyBtn)
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('SDK snippet button opens SDK snippets modal', async () => {
    renderScreen()
    const sdkBtn = await screen.findByRole('button', { name: /sdk snippet/i })
    fireEvent.click(sdkBtn)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('SDK snippets')).toBeInTheDocument()
    })
    // check that we can switch tabs
    const reactTab = screen.getByRole('button', { name: 'React' })
    fireEvent.click(reactTab)
    expect(screen.getByText('typescript')).toBeInTheDocument()

    // check that Go shows coming soon
    const goTab = screen.getByRole('button', { name: /go/i })
    fireEvent.click(goTab)
    expect(screen.getByText(/Go SDK is coming soon/i)).toBeInTheDocument()
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
      environments: [],
      refetchEnvironments: vi.fn(),
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
    expect(screen.getByText(/Enable in Production\?/i)).toBeInTheDocument()
  })

  it('confirming the production toggle calls flagsApi.toggle', async () => {
    const user = userEvent.setup()
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    await user.click(switches[2])
    // modal confirmation is now open; click the Enable button
    const modal = screen.getByRole('dialog')
    const enableBtn = within(modal).getByRole('button', { name: /^enable$/i })
    await user.click(enableBtn)
    await waitFor(() =>
      expect(mockFlagsApi.toggle).toHaveBeenCalledWith('p1', 'my-flag', 'production', true),
    )
  })

  it('disabling production toggle shows confirmation modal, and calling flagsApi.toggle after confirm', async () => {
    const user = userEvent.setup()
    // Override the flag so production starts enabled (on: true)
    const productionOnFlag: Flag = {
      ...mockFlag,
      state: {
        ...mockFlag.state,
        production: { on: true },
      },
    }
    mockFlagsApi.get.mockResolvedValue({ data: productionOnFlag })
    renderScreen()
    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0))
    const switches = screen.getAllByRole('switch')
    await user.click(switches[2])
    expect(mockFlagsApi.toggle).not.toHaveBeenCalled()
    expect(screen.getByText(/Disable in Production\?/i)).toBeInTheDocument()
    // modal confirmation is now open; click the Disable button
    const modal = screen.getByRole('dialog')
    const disableBtn = within(modal).getByRole('button', { name: /^disable$/i })
    await user.click(disableBtn)
    await waitFor(() =>
      expect(mockFlagsApi.toggle).toHaveBeenCalledWith('p1', 'my-flag', 'production', false),
    )
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
