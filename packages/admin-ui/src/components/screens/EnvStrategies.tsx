import { useState } from 'react'

import { useStrategies } from '../../hooks/useStrategies'
import { usePermissions } from '../../hooks/usePermissions'
import type { ContextField } from '../../lib/types'
import { Denied } from '../primitives/Denied'
import { StrategyEditorModal } from './StrategyEditorModal'

interface EnvStrategiesProps {
  projectId: string
  flagKey: string
  env: string
  contextFields: ContextField[]
}

export function EnvStrategies({ projectId, flagKey, env, contextFields }: EnvStrategiesProps) {
  const { strategies, loading, error, refetch } = useStrategies(projectId, flagKey, env)
  const [editing, setEditing] = useState(false)
  const { canWriteEnv } = usePermissions()
  const allowed = canWriteEnv(env)

  return (
    <div className="env-strategies">
      <div className="env-card-foot">
        <div className="env-strategies-state">
          {loading ? (
            <span className="muted">Loading…</span>
          ) : error ? (
            <span>
              <span className="danger-text">{error}</span>{' '}
              <button className="link-btn" onClick={refetch}>
                Retry
              </button>
            </span>
          ) : strategies.length === 0 ? (
            <span className="muted">No targeting rules — default value applies</span>
          ) : (
            <span className="muted">
              {strategies.length} targeting {strategies.length === 1 ? 'rule' : 'rules'}
              {' · '}
              {Array.from(
                new Set(strategies.flatMap((s) => s.constraints.map((c) => c.fieldKey))),
              ).join(', ')}
            </span>
          )}
        </div>

        <Denied when={!allowed} reason={`Your role can’t change targeting in ${env}`}>
          <button className="add-rule-btn" disabled={!allowed} onClick={() => setEditing(true)}>
            Add rule
          </button>
        </Denied>
      </div>

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
