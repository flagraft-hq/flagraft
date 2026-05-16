import { useState } from 'react'
import { Checkbox } from '../primitives/Checkbox'
import { Toggle } from '../primitives/Toggle'
import { Button } from '../primitives/Button'
import { Modal } from '../primitives/Modal'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { StatePill } from './StatePill'
import { TagCluster } from './TagCluster'
import type { Flag } from '../../lib/types'

interface FlagRowProps {
  flag: Flag
  activeEnv: string
  envNames: string[]
  selected: boolean
  onSelect: (key: string, selected: boolean) => void
  onToggle: (key: string, env: string, enabled: boolean) => void
  onClick: (key: string) => void
}

function isProductionEnv(env: string): boolean {
  return env === 'production' || env.endsWith('-production') || env.endsWith('_production')
}

export function FlagRow({
  flag,
  activeEnv,
  envNames,
  selected,
  onSelect,
  onToggle,
  onClick,
}: FlagRowProps) {
  const relativeDate = useRelativeDate(flag.updated)
  const [confirmState, setConfirmState] = useState<{ env: string } | null>(null)

  function handleToggleChange(env: string, checked: boolean) {
    if (isProductionEnv(env) && checked === true) {
      setConfirmState({ env })
    } else {
      onToggle(flag.key, env, checked)
    }
  }

  function handleConfirm() {
    if (confirmState) {
      onToggle(flag.key, confirmState.env, true)
      setConfirmState(null)
    }
  }

  function handleCancel() {
    setConfirmState(null)
  }

  return (
    <div className="flag-row" role="row">
      <Checkbox
        checked={selected}
        onChange={(checked) => onSelect(flag.key, checked)}
        label="Select flag"
      />

      <div
        className="flag-row-name"
        onClick={() => onClick(flag.key)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick(flag.key)
        }}
      >
        <span className="flag-name">{flag.name}</span>
        <span className="flag-key">{flag.key}</span>
        {flag.description && <span className="flag-desc">{flag.description}</span>}
      </div>

      <div className="flag-row-states">
        {envNames.map((env) => (
          <div
            key={env}
            className={`flag-env-toggle${env === activeEnv ? ' flag-env-toggle-active' : ''}`}
          >
            <StatePill
              on={flag.state[env]?.on ?? false}
              envName={env}
              overrides={flag.state[env]?.overrides ?? 0}
            />
            <Toggle
              checked={flag.state[env]?.on ?? false}
              onChange={(checked) => handleToggleChange(env, checked)}
              variant="default"
              label={env}
            />
          </div>
        ))}
      </div>

      <TagCluster tags={flag.tags} />

      <span className="flag-updated">{relativeDate}</span>

      <Modal open={confirmState !== null} onClose={handleCancel}>
        <Modal.Header>Enable in Production?</Modal.Header>
        <Modal.Body>
          <p>
            Enable <strong>{flag.name}</strong> in <strong>{confirmState?.env}</strong>? This will
            affect production traffic.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Enable
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
