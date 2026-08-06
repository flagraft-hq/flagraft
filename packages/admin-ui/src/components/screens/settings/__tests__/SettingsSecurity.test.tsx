import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SettingsSecurity } from '../SettingsSecurity'

/** The mock factories are hoisted, so shared state has to live where they can reach it. */
const state = vi.hoisted(() => ({ role: 'owner' }))

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api')
  return {
    ...actual,
    projectsApi: { update: vi.fn() },
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

const setActiveProject = vi.fn()
let activeProject: { id: string; name: string; slug: string; settings?: Record<string, unknown> } =
  {
    id: 'p1',
    name: 'Demo',
    slug: 'demo',
  }

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject, setActiveProject }),
}))

const pushToast = vi.fn()
vi.mock('../../../../hooks/useToast', () => ({ useToast: () => ({ push: pushToast }) }))

import { projectsApi } from '../../../../lib/api'

describe('SettingsSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = 'owner'
    activeProject = { id: 'p1', name: 'Demo', slug: 'demo' }
  })

  it('defaults to off / no expiry when the project has never saved security settings', () => {
    render(<SettingsSecurity />)
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText('No expiry')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('loads persisted settings from the active project', () => {
    activeProject = {
      ...activeProject,
      settings: { security: { requireApprovalInProd: true, keyTtlDays: 30 } },
    }
    render(<SettingsSecurity />)
    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByText('30 days')).toBeInTheDocument()
  })

  it('saves both fields together and shows a success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(projectsApi.update).mockResolvedValue({
      data: { ...activeProject, settings: { security: { requireApprovalInProd: true } } },
    } as never)
    render(<SettingsSecurity />)

    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(projectsApi.update).toHaveBeenCalledWith('p1', {
        settings: { security: { requireApprovalInProd: true, keyTtlDays: null } },
      }),
    )
    expect(setActiveProject).toHaveBeenCalled()
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', title: 'Security settings saved' }),
    )
  })

  it('discard reverts to the last saved values', async () => {
    const user = userEvent.setup()
    render(<SettingsSecurity />)

    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('surfaces a failed save inline', async () => {
    const user = userEvent.setup()
    vi.mocked(projectsApi.update).mockRejectedValue(new Error('nope'))
    render(<SettingsSecurity />)

    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(screen.getByText('Failed to save security settings')).toBeInTheDocument(),
    )
  })

  it.each(['editor', 'viewer'])(
    'disables saving for an %s even with unsaved changes',
    async (role) => {
      const user = userEvent.setup()
      state.role = role
      render(<SettingsSecurity />)
      await user.click(screen.getByRole('switch'))
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    },
  )
})
