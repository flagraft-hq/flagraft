import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectSwitcherModal } from '../ProjectSwitcherModal'
import type { Project } from '../../../lib/types'

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}))

vi.mock('../../../lib/api', () => ({
  projectsApi: {
    create: vi.fn(),
  },
}))

import { useProject } from '../../../contexts/ProjectContext'
import { projectsApi } from '../../../lib/api'

const mockUseProject = useProject as ReturnType<typeof vi.fn>
const mockProjectsCreate = projectsApi.create as ReturnType<typeof vi.fn>
const mockSetActiveProject = vi.fn()
const mockOnClose = vi.fn()

const projects: Project[] = [
  { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 2 },
  { id: 'p2', name: 'Beta', slug: 'beta', flagCount: 5 },
]

beforeEach(() => {
  mockSetActiveProject.mockClear()
  mockOnClose.mockClear()
  mockProjectsCreate.mockClear()
  mockUseProject.mockReturnValue({
    projects,
    activeProject: projects[0],
    setActiveProject: mockSetActiveProject,
    activeEnv: 'development',
    environments: [],
    refetchEnvironments: vi.fn(),
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
  })
})

describe('ProjectSwitcherModal', () => {
  it('renders project list when open', () => {
    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ProjectSwitcherModal open={false} onClose={mockOnClose} />)
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('calls setActiveProject and onClose when a project row is clicked', () => {
    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('Beta').closest('button')!)
    expect(mockSetActiveProject).toHaveBeenCalledWith(projects[1])
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('shows the "+ New project" button', () => {
    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)
    expect(screen.getByText('+ New project')).toBeInTheDocument()
  })

  it('shows empty state when projects array is empty', () => {
    mockUseProject.mockReturnValue({
      projects: [],
      activeProject: null,
      setActiveProject: mockSetActiveProject,
      activeEnv: 'development',
      environments: [],
      refetchEnvironments: vi.fn(),
      setActiveEnv: vi.fn(),
      loading: false,
      error: null,
    })
    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)
    expect(screen.getByText('No projects found.')).toBeInTheDocument()
  })

  it('clicking New project button opens CreateProjectModal', async () => {
    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByText('New project')).toBeInTheDocument()
  })

  it('after creating a new project, setActiveProject is called with the new project and the modal closes', async () => {
    const newProject: Project = { id: 'p-new', name: 'Gamma', slug: 'gamma', flagCount: 0 }
    mockProjectsCreate.mockResolvedValue({ data: newProject })

    render(<ProjectSwitcherModal open={true} onClose={mockOnClose} />)

    /** Open the CreateProjectModal */
    fireEvent.click(screen.getByRole('button', { name: /new project/i }))
    expect(await screen.findByText('New project')).toBeInTheDocument()

    /** Fill in the name — slug auto-derives to 'gamma' */
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gamma' } })

    /** Submit */
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    /** handleCreated should call setActiveProject with the new project and close the switcher */
    await waitFor(() => expect(mockSetActiveProject).toHaveBeenCalledWith(newProject))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
