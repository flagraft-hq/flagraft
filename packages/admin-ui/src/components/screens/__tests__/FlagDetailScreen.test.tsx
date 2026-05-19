import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
})
