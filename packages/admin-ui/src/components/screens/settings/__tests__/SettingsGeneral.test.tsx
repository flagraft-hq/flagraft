import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SettingsGeneral } from '../SettingsGeneral'

/** The mock factories are hoisted, so shared state has to live where they can reach it. */
const state = vi.hoisted(() => ({ role: 'owner' }))
const refetchProjects = vi.hoisted(() => vi.fn())

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api')
  return {
    ...actual,
    projectsApi: { update: vi.fn(), delete: vi.fn() },
  }
})

vi.mock('../../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: state.role,
    canWrite: state.role !== 'viewer',
    canProjectAdmin: state.role === 'owner' || state.role === 'admin',
    canOwnerAct: state.role === 'owner',
    canWriteEnv: () => true,
  }),
}))

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', description: '' },
    setActiveProject: vi.fn(),
    refetchProjects,
    environments: [{ id: 'e1', slug: 'development', name: 'Development', protected: false }],
  }),
}))

const pushToast = vi.fn()
vi.mock('../../../../hooks/useToast', () => ({ useToast: () => ({ push: pushToast }) }))

import { projectsApi } from '../../../../lib/api'

describe('SettingsGeneral danger zone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = 'owner'
  })

  it('lets an owner open the dialog and delete once the slug is typed', async () => {
    vi.mocked(projectsApi.delete).mockResolvedValue({ data: undefined } as never)
    render(<SettingsGeneral />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }))

    /** The confirm button stays disabled until the slug matches exactly. */
    const confirm = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Delete project',
    })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Type demo to confirm'), 'wrong')
    expect(confirm).toBeDisabled()
    expect(projectsApi.delete).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Type demo to confirm'))
    await userEvent.type(screen.getByLabelText('Type demo to confirm'), 'demo')
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)
    await waitFor(() => expect(projectsApi.delete).toHaveBeenCalledWith('p1'))
    expect(refetchProjects).toHaveBeenCalled()
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', title: 'Project "Demo" deleted' }),
    )
  })

  it('surfaces a failed delete inline and keeps the dialog open', async () => {
    vi.mocked(projectsApi.delete).mockRejectedValue(new Error('nope'))
    render(<SettingsGeneral />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    await userEvent.type(screen.getByLabelText('Type demo to confirm'), 'demo')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete project' }),
    )

    await waitFor(() => expect(screen.getByText('Failed to delete project')).toBeInTheDocument())
    expect(refetchProjects).not.toHaveBeenCalled()
  })

  it.each(['admin', 'editor', 'viewer'])('disables the delete button for an %s', (role) => {
    state.role = role
    render(<SettingsGeneral />)
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeDisabled()
  })
})
