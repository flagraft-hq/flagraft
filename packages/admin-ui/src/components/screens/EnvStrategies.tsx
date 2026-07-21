import { useState } from 'react'

import { useStrategies } from '../../hooks/useStrategies'
import { OPERATORS_BY_TYPE } from '../../lib/operators'
import type { ContextField, StrategyConstraint } from '../../lib/types'
import { Button } from '../primitives/Button'
import { StrategyEditorModal } from './StrategyEditorModal'

interface EnvStrategiesProps {
  projectId: string
  flagKey: string
  env: string
  contextFields: ContextField[]
}

/** Renders "field operator values" for a constraint, using the field's operator label. */
function describeConstraint(c: StrategyConstraint, contextFields: ContextField[]): string {
  const field = contextFields.find((f) => f.key === c.fieldKey)
  const fieldType = field?.type ?? 'string'
  const label =
    OPERATORS_BY_TYPE[fieldType].find((o) => o.value === c.operator)?.label ?? c.operator
  return `${c.fieldKey} ${label} ${c.values.join(', ')}`
}

export function EnvStrategies({ projectId, flagKey, env, contextFields }: EnvStrategiesProps) {
  const { strategies, loading, error, refetch } = useStrategies(projectId, flagKey, env)
  const [editing, setEditing] = useState(false)

  return (
    <div className="env-strategies">
      <div className="env-strategies-head">
        <span className="env-strategies-label">Targeting</span>
        <span className="spacer" />
        <Button size="sm" variant="ghost" leftIcon="target" onClick={() => setEditing(true)}>
          Edit targeting
        </Button>
      </div>

      {loading ? (
        <div className="env-strategies-state muted">Loading…</div>
      ) : error ? (
        <div className="env-strategies-state">
          <span className="danger-text">{error}</span>{' '}
          <button className="link-btn" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : strategies.length === 0 ? (
        <div className="env-strategies-state muted">On for everyone while enabled.</div>
      ) : (
        <ul className="env-strategies-list">
          {strategies.map((s) => (
            <li key={s.id} className="env-strategy-row">
              {s.constraints.length === 0 ? (
                <span className="muted">matches everyone</span>
              ) : (
                s.constraints.map((c, i) => (
                  <span key={i} className="strat-chip mono">
                    {describeConstraint(c, contextFields)}
                  </span>
                ))
              )}
            </li>
          ))}
        </ul>
      )}

      <StrategyEditorModal
        open={editing}
        projectId={projectId}
        flagKey={flagKey}
        env={env}
        contextFields={contextFields}
        initialStrategies={strategies}
        onClose={() => setEditing(false)}
        onSaved={refetch}
      />
    </div>
  )
}
