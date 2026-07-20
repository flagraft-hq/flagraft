import { useEffect, useState } from 'react'

import { strategiesApi, ApiError } from '../../lib/api'
import { OPERATORS_BY_TYPE, isMultiValueOperator } from '../../lib/operators'
import type { ContextField, Strategy } from '../../lib/types'
import { Button } from '../primitives/Button'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'
import { TextField } from '../primitives/TextField'

interface DraftConstraint {
  fieldKey: string
  operator: string
  valuesText: string
}
interface DraftStrategy {
  constraints: DraftConstraint[]
}

interface StrategyEditorModalProps {
  open: boolean
  projectId: string
  flagKey: string
  env: string
  contextFields: ContextField[]
  initialStrategies: Strategy[]
  onClose: () => void
  onSaved: () => void
}

function toDraft(strategies: Strategy[]): DraftStrategy[] {
  return strategies.map((s) => ({
    constraints: s.constraints.map((c) => ({
      fieldKey: c.fieldKey,
      operator: c.operator,
      valuesText: c.values.join(', '),
    })),
  }))
}

export function StrategyEditorModal({
  open,
  projectId,
  flagKey,
  env,
  contextFields,
  initialStrategies,
  onClose,
  onSaved,
}: StrategyEditorModalProps) {
  const [drafts, setDrafts] = useState<DraftStrategy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDrafts(toDraft(initialStrategies))
      setError(null)
    }
  }, [open, initialStrategies])

  function operatorsFor(fieldKey: string) {
    const field = contextFields.find((f) => f.key === fieldKey)
    return OPERATORS_BY_TYPE[field?.type ?? 'string']
  }

  function defaultConstraint(): DraftConstraint {
    const fieldKey = contextFields[0]?.key ?? ''
    const ops = fieldKey ? operatorsFor(fieldKey) : []
    return { fieldKey, operator: ops[0]?.value ?? '', valuesText: '' }
  }

  /** Immutably replace one strategy's constraints. */
  function patchStrategy(si: number, constraints: DraftConstraint[]) {
    setDrafts((prev) => prev.map((s, i) => (i === si ? { constraints } : s)))
  }

  function updateConstraint(si: number, ci: number, patch: Partial<DraftConstraint>) {
    setDrafts((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s
        return {
          constraints: s.constraints.map((c, j) => {
            if (j !== ci) return c
            const next = { ...c, ...patch }
            // Changing the field can invalidate the operator — reset to the first valid one.
            if (patch.fieldKey !== undefined) {
              next.operator = operatorsFor(patch.fieldKey)[0]?.value ?? ''
            }
            return next
          }),
        }
      }),
    )
  }

  async function handleSave() {
    const payload = drafts.map((s) => ({
      constraints: s.constraints.map((c) => ({
        fieldKey: c.fieldKey,
        operator: c.operator,
        values: c.valuesText
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      })),
    }))
    for (const s of payload) {
      for (const c of s.constraints) {
        if (!c.fieldKey || !c.operator || c.values.length === 0) {
          setError('Every constraint needs a field, an operator, and at least one value.')
          return
        }
      }
    }
    setSaving(true)
    setError(null)
    try {
      await strategiesApi.replace(projectId, flagKey, env, payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save strategies')
    } finally {
      setSaving(false)
    }
  }

  const fieldOptions = contextFields.map((f) => ({ value: f.key, label: f.key }))
  const noFields = contextFields.length === 0

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header subtitle={`Serve this flag ON when a strategy matches, in ${env}.`}>
        Targeting strategies
      </Modal.Header>
      <Modal.Body>
        <FormError message={error} />
        {noFields && (
          <div className="strat-note">
            Register a context field in Settings first — strategies match on context fields.
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="strat-empty">
            No strategies. The flag is on for everyone while enabled. Add a strategy to narrow it.
          </div>
        ) : (
          <div className="strat-list">
            {drafts.map((strategy, si) => (
              <div key={si} className="strat-card">
                <div className="strat-card-head">
                  <span className="strat-card-title">Strategy {si + 1}</span>
                  {strategy.constraints.length === 0 && (
                    <span className="muted strat-matches-all">matches everyone</span>
                  )}
                  <span className="spacer" />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove strategy ${si + 1}`}
                    onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== si))}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>

                {strategy.constraints.map((c, ci) => (
                  <div key={ci} className="strat-constraint">
                    <Select
                      options={fieldOptions}
                      value={c.fieldKey}
                      placeholder=""
                      onChange={(v) => updateConstraint(si, ci, { fieldKey: v })}
                    />
                    <Select
                      options={operatorsFor(c.fieldKey)}
                      value={c.operator}
                      placeholder=""
                      onChange={(v) => updateConstraint(si, ci, { operator: v })}
                    />
                    <TextField
                      className="mono strat-values"
                      value={c.valuesText}
                      onChange={(v) => updateConstraint(si, ci, { valuesText: v })}
                      placeholder={isMultiValueOperator(c.operator) ? 'a, b, c' : 'value'}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Remove constraint"
                      onClick={() =>
                        patchStrategy(
                          si,
                          strategy.constraints.filter((_, j) => j !== ci),
                        )
                      }
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon="plus"
                  disabled={noFields}
                  onClick={() => patchStrategy(si, [...strategy.constraints, defaultConstraint()])}
                >
                  Add condition
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="strat-add">
          <Button
            variant="ghost"
            leftIcon="plus"
            onClick={() => setDrafts((prev) => [...prev, { constraints: [] }])}
          >
            Add strategy
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save strategies'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
