import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsScreen } from '../SettingsScreen'

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}))

// Stub the section bodies so this test covers only the rail + routing.
vi.mock('../settings/SettingsGeneral', () => ({
  SettingsGeneral: () => <div>general-body</div>,
}))
vi.mock('../settings/SettingsDefaults', () => ({
  SettingsDefaults: () => <div>defaults-body</div>,
}))
vi.mock('../settings/SettingsSecurity', () => ({
  SettingsSecurity: () => <div>security-body</div>,
}))
vi.mock('../settings/SettingsMembers', () => ({
  SettingsMembers: () => <div>members-body</div>,
}))
vi.mock('../ContextFieldsSection', () => ({
  ContextFieldsSection: () => <div>context-body</div>,
}))

import { useProject } from '../../../contexts/ProjectContext'

const mockUseProject = useProject as ReturnType<typeof vi.fn>

const activeProject = { id: 'p1', name: 'My Project', slug: 'my-proj', flagCount: 5 }

beforeEach(() => {
  mockUseProject.mockReturnValue({ activeProject })
})

describe('SettingsScreen', () => {
  it('renders the section rail', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('Project settings')).toBeInTheDocument()
    for (const label of ['General', 'Flag defaults', 'Context fields', 'Security', 'Members & roles']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the General section by default', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('general-body')).toBeInTheDocument()
    expect(screen.queryByText('members-body')).not.toBeInTheDocument()
  })

  it('switches sections when a rail item is clicked', async () => {
    render(<SettingsScreen />)
    await userEvent.click(screen.getByText('Members & roles'))
    expect(screen.getByText('members-body')).toBeInTheDocument()
    expect(screen.queryByText('general-body')).not.toBeInTheDocument()
  })

  it('shows no-project fallback when activeProject is null', () => {
    mockUseProject.mockReturnValue({ activeProject: null })
    render(<SettingsScreen />)
    expect(screen.getByText('No project selected')).toBeInTheDocument()
  })
})
