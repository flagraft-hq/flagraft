import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Table } from '@heroui/react'

import { FlagRow } from '../FlagRow'
import type { Flag } from '../../../lib/types'

/** The mock factory is hoisted, so the role has to live somewhere it can reach. */
const state = vi.hoisted(() => ({ role: 'editor' }))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', name: 'A', role: state.role } }),
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    environments: [
      { id: 'e1', slug: 'development', name: 'Development', color: 'teal', protected: false },
      { id: 'e2', slug: 'production', name: 'Production', color: 'rose', protected: true },
    ],
  }),
}))

vi.mock('../../../hooks/useRelativeDate', () => ({ useRelativeDate: () => '2 days ago' }))

const flag: Flag = {
  key: 'my-feature',
  name: 'My Feature',
  description: 'A test feature flag',
  created: '2025-01-01',
  updated: '2025-01-10',
  state: { development: { on: true }, production: { on: false } },
  author: 'alice',
}

const onToggle = vi.fn()

/** A row only renders inside a table; see FlagRow.test.tsx for the reasoning. */
function renderRow() {
  return render(
    <Table>
      <Table.Content aria-label="Flags" selectionMode="multiple">
        <Table.Header>
          <Table.Column id="select">{''}</Table.Column>
          <Table.Column id="name" isRowHeader>
            Flag
          </Table.Column>
          <Table.Column id="development">development</Table.Column>
          <Table.Column id="production">production</Table.Column>
          <Table.Column id="updated">Last edited</Table.Column>
        </Table.Header>
        <Table.Body>
          <FlagRow
            flag={flag}
            activeEnv="development"
            envNames={['development', 'production']}
            onToggle={onToggle}
            onClick={vi.fn()}
          />
        </Table.Body>
      </Table.Content>
    </Table>,
  )
}

describe('FlagRow permission gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.role = 'editor'
  })

  it('lets an editor toggle development but not protected production', async () => {
    renderRow()

    const dev = screen.getByRole('switch', { name: 'my-feature in development' })
    const prod = screen.getByRole('switch', { name: 'my-feature in production' })
    expect(dev).toBeEnabled()
    expect(prod).toBeDisabled()

    await userEvent.click(dev)
    expect(onToggle).toHaveBeenCalledWith('my-feature', 'development', false)
  })

  it('leaves both toggles enabled for an admin', () => {
    state.role = 'admin'
    renderRow()

    expect(screen.getByRole('switch', { name: 'my-feature in development' })).toBeEnabled()
    expect(screen.getByRole('switch', { name: 'my-feature in production' })).toBeEnabled()
  })

  it('disables every toggle for a viewer', () => {
    state.role = 'viewer'
    renderRow()

    expect(screen.getByRole('switch', { name: 'my-feature in development' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'my-feature in production' })).toBeDisabled()
  })
})
