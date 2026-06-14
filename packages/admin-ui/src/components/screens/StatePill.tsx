import { Toggle } from '../primitives/Toggle'
import { Icon } from '../primitives/Icon'

interface StatePillProps {
  on: boolean
  env: string
  overrides?: number
  onToggle: (checked: boolean) => void
  flagKey?: string
}

/**
 * Per-environment state cell used in the flags list. It bundles the toggle,
 * a small on/off label, and (when present) an override count into one unit,
 * matching the redesigned flags layout where each environment is a column.
 */
export function StatePill({ on, env, overrides = 0, onToggle, flagKey }: StatePillProps) {
  const hasOverrides = overrides > 0
  const classes = [
    'state-pill',
    on ? 'state-pill-on' : 'state-pill-off',
    hasOverrides ? 'has-overrides' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} data-env={env}>
      <Toggle
        checked={on}
        size="sm"
        onChange={onToggle}
        label={flagKey ? `${flagKey} in ${env}` : env}
      />
      <span className="state-label">{on ? 'on' : 'off'}</span>
      {hasOverrides && (
        <span className="state-pill-overrides" aria-label={`${overrides} overrides`}>
          <Icon name="target" size={11} />
          <span className="num">{overrides}</span>
        </span>
      )}
    </div>
  )
}
