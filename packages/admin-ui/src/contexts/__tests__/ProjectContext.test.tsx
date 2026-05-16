import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { ProjectProvider, useProject } from '../ProjectContext'
import * as api from '../../lib/api'
import type { Project } from '../../lib/types'

function TestConsumer() {
  const ctx = useProject()
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="error">{ctx.error ?? 'null'}</span>
      <span data-testid="projects-count">{ctx.projects.length}</span>
      <span data-testid="active-project">{ctx.activeProject?.id ?? 'null'}</span>
      <span data-testid="active-env">{ctx.activeEnv}</span>
      <button onClick={() => ctx.setActiveProject(ctx.projects[1])}>set second</button>
      <button onClick={() => ctx.setActiveEnv('production')}>set production</button>
    </div>
  )
}

const mockProjects: Project[] = [
  { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 3 },
  { id: 'p2', name: 'Beta', slug: 'beta', flagCount: 1 },
]

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading=true initially before fetch resolves', () => {
    vi.spyOn(api.projectsApi, 'list').mockReturnValue(new Promise(() => {}))
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    expect(screen.getByTestId('loading').textContent).toBe('true')
  })

  it('sets projects after successful fetch', async () => {
    vi.spyOn(api.projectsApi, 'list').mockResolvedValue({ data: mockProjects } as AxiosResponse<
      Project[]
    >)
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('projects-count').textContent).toBe('2'))
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('sets activeProject to first project after fetch', async () => {
    vi.spyOn(api.projectsApi, 'list').mockResolvedValue({ data: mockProjects } as AxiosResponse<
      Project[]
    >)
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('active-project').textContent).toBe('p1'))
  })

  it('sets error on fetch failure', async () => {
    vi.spyOn(api.projectsApi, 'list').mockRejectedValue(new Error('Network error'))
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Network error'))
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('useProject throws when called outside ProjectProvider', () => {
    // Suppress React error boundary console noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useProject called outside ProjectProvider')
    consoleSpy.mockRestore()
  })

  it('setActiveProject updates the active project', async () => {
    vi.spyOn(api.projectsApi, 'list').mockResolvedValue({ data: mockProjects } as AxiosResponse<
      Project[]
    >)
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('active-project').textContent).toBe('p1'))
    act(() => {
      screen.getByText('set second').click()
    })
    expect(screen.getByTestId('active-project').textContent).toBe('p2')
  })

  it('setActiveEnv updates the active env', async () => {
    vi.spyOn(api.projectsApi, 'list').mockResolvedValue({ data: mockProjects } as AxiosResponse<
      Project[]
    >)
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('active-env').textContent).toBe('development')
    act(() => {
      screen.getByText('set production').click()
    })
    expect(screen.getByTestId('active-env').textContent).toBe('production')
  })
})
