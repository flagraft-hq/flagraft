import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsScreen } from '../SettingsScreen'

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

import { useProject } from '../../../contexts/ProjectContext'

const mockUseProject = useProject as ReturnType<typeof vi.fn>

const activeProject = {
  id: 'p1',
  name: 'My Project',
  slug: 'my-proj',
  flagCount: 5,
}

beforeEach(() => {
  mockUseProject.mockReturnValue({ activeProject })
})

describe('SettingsScreen', () => {
  it('renders project name, slug, and id from context', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('My Project')).toBeInTheDocument()
    expect(screen.getByText('my-proj')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
  })

  it('renders environment chips', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('development')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('renders disabled delete project button', () => {
    render(<SettingsScreen />)
    const btn = screen.getByRole('button', { name: /delete project/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()
  })

  it('shows no-project fallback when activeProject is null', () => {
    mockUseProject.mockReturnValue({ activeProject: null })
    render(<SettingsScreen />)
    expect(screen.getByText('No project selected')).toBeInTheDocument()
  })
})
