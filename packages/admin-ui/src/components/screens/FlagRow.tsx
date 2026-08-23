import { useState } from 'react'
import { Button, Checkbox, Chip, Table } from '@heroui/react'
import { Dialog } from '../primitives/Dialog'
import { Tip } from '../primitives/Tip'
import { Denied } from '../primitives/Denied'
import { usePermissions } from '../../hooks/usePermissions'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { StatePill } from './StatePill'
import type { Flag } from '../../lib/types'

interface FlagRowProps {
  flag: Flag
  activeEnv: string
  envNames: string[]
  /** True when the flag hasn't changed within the project's stale window. */
  stale?: boolean
  onToggle: (key: string, env: string, enabled: boolean) => void
  onClick: (key: string) => void
}

function isProductionEnv(env: string): boolean {
  return env === 'production' || env.endsWith('-production') || env.endsWith('_production')
}

const AVATAR_COLORS = ['teal', 'violet', 'amber', 'rose', 'slate']

/**
 * Derives a deterministic avatar (initials + color) from the author string,
 * so the same author always gets the same colored badge across rows.
 */
function avatarFor(author?: string | null): { initials: string; color: string } {
  const name = author || 'System'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return {
    initials: name.slice(0, 2).toUpperCase() || '—',
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length],
  }
}

/**
 * One row of the flags table. Selection is owned by the table rather than by
 * this component: the checkbox carries React Aria's `selection` slot, so the
 * table wires it to its own `selectedKeys` and this row never sees the state.
 */
export function FlagRow({
  flag,
  activeEnv,
  envNames,
  stale = false,
  onToggle,
  onClick,
}: FlagRowProps) {
  const relativeDate = useRelativeDate(flag.updated)
  const [confirmState, setConfirmState] = useState<{ env: string; checked: boolean } | null>(null)
  const avatar = avatarFor(flag.author)
  const { canWriteEnv } = usePermissions()

  /**
   * Enabling or disabling a production environment routes through a confirmation modal;
   * every other change applies immediately.
   */
  function handleToggleChange(env: string, checked: boolean) {
    if (isProductionEnv(env)) {
      setConfirmState({ env, checked })
    } else {
      onToggle(flag.key, env, checked)
    }
  }

  function handleConfirm() {
    if (confirmState) {
      onToggle(flag.key, confirmState.env, confirmState.checked)
      setConfirmState(null)
    }
  }

  return (
    <Table.Row id={flag.key} className="flags-row">
      <Table.Cell className="cell-check">
        {/**
         * React Aria composes this label with the row header cell, so the
         * screen reader hears "Select" followed by the flag's own name --
         * repeating the name here would say it twice.
         */}
        <Checkbox slot="selection" aria-label="Select">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </Table.Cell>

      <Table.Cell className="cell-name">
        <button type="button" className="name-stack" onClick={() => onClick(flag.key)}>
          <span className="flag-name">
            <span className="flag-name-text">{flag.name}</span>
            {stale ? (
              <Tip tip={`No value change since ${relativeDate} — review or remove`}>
                <span className="flag-stale-badge">
                  <Chip className="flags-stale" size="sm">
                    stale
                  </Chip>
                </span>
              </Tip>
            ) : null}
          </span>
          <span className="flag-key mono">{flag.key}</span>
        </button>
      </Table.Cell>

      {envNames.map((env) => {
        const allowed = canWriteEnv(env)
        return (
          <Table.Cell
            key={env}
            className={`cell-env${isProductionEnv(env) ? ' cell-env-prod' : ''}${
              env === activeEnv ? ' cell-env-active' : ''
            }`}
          >
            <Denied when={!allowed} reason={`Your role can’t change flags in ${env}`}>
              <StatePill
                on={flag.state?.[env]?.on ?? false}
                env={env}
                flagKey={flag.key}
                disabled={!allowed}
                pending={flag.state?.[env]?.pending}
                onToggle={(checked) => handleToggleChange(env, checked)}
              />
            </Denied>
          </Table.Cell>
        )
      })}

      <Table.Cell className="cell-edited">
        <div className="cell-edited-inner">
          <span className={`flag-avatar flag-avatar-sm flag-avatar-${avatar.color}`} aria-hidden="true">
            {avatar.initials}
          </span>
          <div className="edited-stack">
            <span className="edited-author">{flag.author || 'System'}</span>
            <span className="edited-when">{relativeDate}</span>
          </div>
        </div>

        {/**
         * ponytail: the confirm dialog lives inside a cell because a
         * `Table.Row` may only have cells as children -- React Aria reads them
         * to build its collection. It portals out of the table either way.
         */}
        <Dialog
          className="flags-dialog"
          open={confirmState !== null}
          onClose={() => setConfirmState(null)}
          title={`${confirmState?.checked ? 'Enable' : 'Disable'} in Production?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmState(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirm}>
                {confirmState?.checked ? 'Enable' : 'Disable'}
              </Button>
            </>
          }
        >
          <p>
            {confirmState?.checked ? 'Enable' : 'Disable'} <strong>{flag.name}</strong> in{' '}
            <strong>{confirmState?.env}</strong>? This will affect production traffic.
          </p>
        </Dialog>
      </Table.Cell>
    </Table.Row>
  )
}
