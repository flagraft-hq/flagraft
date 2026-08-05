import { Toggle } from '../primitives/Toggle'

interface StatePillProps {
  on: boolean
  env: string
  onToggle: (checked: boolean) => void
  flagKey?: string
  /** Set when the current role may not change this environment. */
  disabled?: boolean
}

/**
 * Per-environment state cell used in the flags list. It bundles the toggle
 * and a small on/off label into one unit, matching the redesigned flags
 * layout where each environment is a column.
 */
export function StatePill({ on, env, onToggle, flagKey, disabled = false }: StatePillProps) {
  const classes = ['state-pill', on ? 'state-pill-on' : 'state-pill-off'].join(' ')

  return (
    <div className={classes} data-env={env}>
      <Toggle
        checked={on}
        size="sm"
        disabled={disabled}
        onChange={onToggle}
        label={flagKey ? `${flagKey} in ${env}` : env}
      />
      <span className="state-label">{on ? 'on' : 'off'}</span>
    </div>
  )
}
