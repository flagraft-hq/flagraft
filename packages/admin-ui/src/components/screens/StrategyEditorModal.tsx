import { useEffect, useState } from 'react'

import { strategiesApi, ApiError } from '../../lib/api'
import { OPERATORS_BY_TYPE } from '../../lib/operators'
import type { ContextField, Strategy, StrategyVariantInput } from '../../lib/types'
import { fillWeights, percentToWeight, toDraftVariant, type DraftVariant } from '../../lib/variants'
import { Button } from '../primitives/Button'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'
import { StrategyVariantsEditor } from './StrategyVariantsEditor'

interface DraftConstraint {
  fieldKey: string
  operator: string
  values: string[]
}
interface DraftStrategy {
  constraints: DraftConstraint[]
  variants: DraftVariant[]
  stickiness: string
}

function MultiValueInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = input.trim()
      if (val && !values.includes(val)) {
        onChange([...values, val])
      }
      setInput('')
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const handleBlur = () => {
    const val = input.trim()
    if (val && !values.includes(val)) {
      onChange([...values, val])
    }
    setInput('')
  }

  return (
    <div
      className="token-input strat-values"
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.classList.contains('token-input')) {
          target.querySelector('input')?.focus()
        }
      }}
    >
      {values.map((v, i) => (
        <span key={i} className="token-val mono">
          {v}
          <button
            type="button"
            className="token-remove"
            onClick={(e) => {
              e.stopPropagation()
              onChange(values.filter((_, j) => j !== i))
            }}
          >
            <Icon name="x" size={10} />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="token-input-field mono"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={values.length === 0 ? placeholder : ''}
      />
    </div>
  )
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
      values: c.values,
    })),
    variants: (s.variants ?? []).map(toDraftVariant),
    stickiness: s.variants?.[0]?.stickiness ?? 'default',
  }))
}

/** Returns the request variants, or a message saying why the draft cannot be saved. */
function toVariantInput(strategy: DraftStrategy): StrategyVariantInput[] | string {
  const fixedWeights: (number | null)[] = []
  const variants: StrategyVariantInput[] = []

  for (const variant of strategy.variants) {
    const name = variant.name.trim()
    if (!name) return 'Every variant needs a name.'

    const weight = variant.fixed ? percentToWeight(variant.percent) : null
    if (variant.fixed && weight === null) return 'A fixed weight must be between 0 and 100%.'
    fixedWeights.push(weight)

    variants.push({
      name,
      weightType: variant.fixed ? 'fix' : 'variable',
      ...(weight === null ? {} : { weight }),
      stickiness: strategy.stickiness,
      ...(variant.payloadType
        ? { payload: { type: variant.payloadType, value: variant.payloadValue } }
        : {}),
    })
  }

  if (!fillWeights(fixedWeights)) {
    return 'Fixed weights must add up to 100%, or leave at least one variant on automatic.'
  }
  return variants
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
    return { fieldKey, operator: ops[0]?.value ?? '', values: [] }
  }

  function patchDraft(si: number, patch: Partial<DraftStrategy>) {
    setDrafts((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)))
  }

  /** Immutably replace one strategy's constraints. */
  function patchStrategy(si: number, constraints: DraftConstraint[]) {
    patchDraft(si, { constraints })
  }

  function updateConstraint(si: number, ci: number, patch: Partial<DraftConstraint>) {
    setDrafts((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s
        return {
          ...s,
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
    const payload = []
    for (const s of drafts) {
      const variants = toVariantInput(s)
      if (typeof variants === 'string') {
        setError(variants)
        return
      }
      payload.push({
        constraints: s.constraints.map((c) => ({
          fieldKey: c.fieldKey,
          operator: c.operator,
          values: c.values.filter(Boolean),
        })),
        variants,
      })
    }
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
      <Modal.Header
        subtitle={`Serve this flag ON when a strategy matches, in ${env}. Variants split the matched users.`}
      >
        Targeting strategies
      </Modal.Header>
      <Modal.Body>
        <FormError message={error} />
        {noFields && (
          <div className="strat-note">
            <Icon name="info" size={16} />
            <span>
              Register a context field in Settings first as strategies match on context fields.
            </span>
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
                    <MultiValueInput
                      values={c.values}
                      onChange={(v) => updateConstraint(si, ci, { values: v })}
                      placeholder="Type and press Enter or comma..."
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
                  className="strat-add-condition"
                  disabled={noFields}
                  onClick={() => patchStrategy(si, [...strategy.constraints, defaultConstraint()])}
                >
                  Add condition
                </Button>

                <StrategyVariantsEditor
                  variants={strategy.variants}
                  stickiness={strategy.stickiness}
                  contextFieldKeys={contextFields.map((f) => f.key)}
                  onVariantsChange={(variants) => patchDraft(si, { variants })}
                  onStickinessChange={(stickiness) => patchDraft(si, { stickiness })}
                />
              </div>
            ))}
          </div>
        )}

        <div className="strat-add">
          <Button
            variant="ghost"
            leftIcon="plus"
            onClick={() =>
              setDrafts((prev) => [
                ...prev,
                { constraints: [], variants: [], stickiness: 'default' },
              ])
            }
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
