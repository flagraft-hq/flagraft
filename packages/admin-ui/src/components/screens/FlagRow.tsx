import { useState } from 'react'
import { Checkbox } from '../primitives/Checkbox'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'
import { Modal } from '../primitives/Modal'
import { Tip } from '../primitives/Tip'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { StatePill } from './StatePill'
import { TagCluster } from './TagCluster'
import type { Flag } from '../../lib/types'

interface FlagRowProps {
  flag: Flag
  activeEnv: string
  envNames: string[]
  selected: boolean
  /** True when the flag hasn't changed within the project's stale window. */
  stale?: boolean
  onSelect: (key: string, selected: boolean) => void
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

export function FlagRow({
  flag,
  activeEnv,
  envNames,
  selected,
  stale = false,
  onSelect,
  onToggle,
  onClick,
}: FlagRowProps) {
  const relativeDate = useRelativeDate(flag.updated)
  const [confirmState, setConfirmState] = useState<{ env: string; checked: boolean } | null>(null)
  const avatar = avatarFor(flag.author)

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

  function handleCancel() {
    setConfirmState(null)
  }

  function openDetail() {
    onClick(flag.key)
  }

  return (
    <div
      className={`flags-row body${selected ? ' selected' : ''}`}
      role="row"
      data-selected={selected || undefined}
    >
      <div className="cell-check">
        <Checkbox
          checked={selected}
          onChange={(checked) => onSelect(flag.key, checked)}
          ariaLabel="Select flag"
        />
      </div>

      <div
        className="cell-name"
        onClick={openDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openDetail()
        }}
      >
        <div className="name-stack">
          <span className="flag-name">
            <span className="flag-name-text">{flag.name}</span>
            {stale ? (
              <Tip tip={`No value change since ${relativeDate} — review or remove`}>
                <span className="flag-stale-badge">
                  <Badge variant="warning">stale</Badge>
                </span>
              </Tip>
            ) : null}
          </span>
          <span className="flag-key mono">{flag.key}</span>
        </div>
        <TagCluster tags={flag.tags ?? []} />
      </div>

      {envNames.map((env) => (
        <div
          key={env}
          className={`cell-env${isProductionEnv(env) ? ' cell-env-prod' : ''}${
            env === activeEnv ? ' cell-env-active' : ''
          }`}
        >
          <StatePill
            on={flag.state?.[env]?.on ?? false}
            env={env}
            flagKey={flag.key}
            onToggle={(checked) => handleToggleChange(env, checked)}
          />
        </div>
      ))}

      <div className="cell-edited">
        <span className={`avatar avatar-sm avatar-${avatar.color}`} aria-hidden="true">
          {avatar.initials}
        </span>
        <div className="edited-stack">
          <span className="edited-author">{flag.author || 'System'}</span>
          <span className="edited-when">{relativeDate}</span>
        </div>
      </div>

      <Modal open={confirmState !== null} onClose={handleCancel}>
        <Modal.Header>{confirmState?.checked ? 'Enable' : 'Disable'} in Production?</Modal.Header>
        <Modal.Body>
          <p>
            {confirmState?.checked ? 'Enable' : 'Disable'} <strong>{flag.name}</strong> in{' '}
            <strong>{confirmState?.env}</strong>? This will affect production traffic.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            {confirmState?.checked ? 'Enable' : 'Disable'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
