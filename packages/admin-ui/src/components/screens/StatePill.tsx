import { Chip, Switch } from '@heroui/react'
import { Tip } from '../primitives/Tip'
import type { PendingToggle } from '../../lib/types'

interface StatePillProps {
  on: boolean
  env: string
  onToggle: (checked: boolean) => void
  flagKey?: string
  /** Set when the current role may not change this environment. */
  disabled?: boolean
  /** Set while a toggle in this environment awaits a second, distinct admin. */
  pending?: PendingToggle
}

/**
 * Per-environment state cell used in the flags list. It bundles the toggle
 * and a small on/off label into one unit, matching the redesigned flags
 * layout where each environment is a column.
 */
export function StatePill({
  on,
  env,
  onToggle,
  flagKey,
  disabled = false,
  pending,
}: StatePillProps) {
  const classes = ['state-pill', on ? 'state-pill-on' : 'state-pill-off'].join(' ')

  return (
    <div className={classes} data-env={env}>
      <Switch
        size="sm"
        isSelected={on}
        isDisabled={disabled}
        onChange={onToggle}
        aria-label={flagKey ? `${flagKey} in ${env}` : env}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <span className="state-label">{on ? 'on' : 'off'}</span>
      {pending && (
        <Tip
          tip={`${pending.requestedBy} requested ${pending.requestedEnabled ? 'on' : 'off'} -- toggle the same way to confirm.`}
        >
          <span>
            <Chip className="flags-pending" size="sm">
              pending
            </Chip>
          </span>
        </Tip>
      )}
    </div>
  )
}
