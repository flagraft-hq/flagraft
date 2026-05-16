interface StatePillProps {
  on: boolean
  envName?: string
  overrides?: number
}

export function StatePill({ on, envName, overrides }: StatePillProps) {
  const classes = ['state-pill', on ? 'state-pill-on' : 'state-pill-off'].join(' ')

  return (
    <span className={classes}>
      {on ? 'On' : 'Off'}
      {envName !== undefined && <span className="state-pill-env">{envName}</span>}
      {overrides !== undefined && overrides > 0 && (
        <span className="state-pill-overrides">{overrides}</span>
      )}
    </span>
  )
}
