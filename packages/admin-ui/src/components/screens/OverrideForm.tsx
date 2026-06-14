import React, { useState } from 'react'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import type { Override, ContextField, FieldType } from '../../lib/types'
import { OPS_BY_TYPE } from '../../lib/types'
import { validateOverrideForm } from '../../lib/validation'
import type { OverrideValidationErrors } from '../../lib/validation'

interface OverrideFormProps {
  projectId: string
  flagKey: string
  env: string
  contextFields: ContextField[]
  existingOverrides: Override[]
  editingOverride?: Override | null
  onSave: (data: Omit<Override, 'id' | 'flag' | 'created'>) => Promise<void>
  onCancel: () => void
}

const OTHER_KEY = '__other__'

export const OverrideForm: React.FC<OverrideFormProps> = ({
  env,
  contextFields,
  existingOverrides,
  editingOverride,
  onSave,
  onCancel,
}) => {
  const isEditMode = !!editingOverride

  const [key, setKey] = useState(editingOverride?.key ?? '')
  const [keySelectValue, setKeySelectValue] = useState(() => {
    if (!editingOverride?.key) return ''
    const inList = contextFields.some((f) => f.key === editingOverride.key)
    return inList ? editingOverride.key : OTHER_KEY
  })
  const [customKey, setCustomKey] = useState(() => {
    if (!editingOverride?.key) return ''
    const inList = contextFields.some((f) => f.key === editingOverride.key)
    return inList ? '' : editingOverride.key
  })
  const [op, setOp] = useState(editingOverride?.op ?? '')
  const [val, setVal] = useState(editingOverride?.val ?? '')
  const [result, setResult] = useState(editingOverride ? String(editingOverride.result) : 'true')
  const [note, setNote] = useState(editingOverride?.note ?? '')
  const [errors, setErrors] = useState<OverrideValidationErrors>({})
  const [saving, setSaving] = useState(false)

  /** Field metadata for the currently-selected key (drives type + hints). */
  const selectedField = contextFields.find((f) => f.key === key)
  const fieldType: FieldType = selectedField?.type ?? 'string'
  const operators = OPS_BY_TYPE[fieldType] ?? OPS_BY_TYPE['string']

  /** Another rule on the same key/value returns the opposite result. */
  const conflict = existingOverrides.some(
    (x) =>
      x.id !== editingOverride?.id && x.key === key && x.val === val && String(x.result) !== result,
  )

  const handleKeySelectChange = (value: string) => {
    setKeySelectValue(value)
    setKey(value === OTHER_KEY ? customKey : value)
    setOp('')
    setVal('')
  }

  const handleCustomKeyChange = (value: string) => {
    setCustomKey(value)
    setKey(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateOverrideForm(
      { key, op, val, env },
      existingOverrides,
      contextFields,
      editingOverride?.id,
    )
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await onSave({ env, key, op, val, result: result === 'true', note })
    } finally {
      setSaving(false)
    }
  }

  const keySelectOptions = [
    ...contextFields.map((f) => ({ value: f.key, label: f.key })),
    ...(contextFields.length > 0 ? [{ value: OTHER_KEY, label: 'Other (type key)' }] : []),
  ]
  const showCustomKeyInput = keySelectValue === OTHER_KEY || contextFields.length === 0

  const valuePlaceholder =
    op === 'in' ? 'samsung, verizon, att' : (selectedField?.example ?? 'value')

  return (
    <form
      className="override-form ctx-ovr-form"
      data-mode={isEditMode ? 'edit' : 'add'}
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
    >
      <div className="form-head">
        <span className="form-title">{isEditMode ? 'Edit override' : 'New override'}</span>
        <span className="muted form-head-env">
          in{' '}
          <span className="mono" data-env={env}>
            {env}
          </span>
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn"
          onClick={onCancel}
          aria-label="Close"
          disabled={saving}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className="form-grid">
        {/* Context key */}
        <div className="form-field">
          <label htmlFor="override-key-select">When context key</label>
          {contextFields.length > 0 ? (
            <>
              <select
                id="override-key-select"
                className={`select mono${errors.key ? ' error' : ''}`}
                value={keySelectValue}
                onChange={(e) => handleKeySelectChange(e.target.value)}
                disabled={saving}
                aria-label="When context key"
                aria-invalid={!!errors.key}
              >
                <option value="" disabled>
                  Select…
                </option>
                {keySelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {showCustomKeyInput && (
                <input
                  className="input mono"
                  placeholder="Enter context key"
                  value={customKey}
                  onChange={(e) => handleCustomKeyChange(e.target.value)}
                  disabled={saving}
                  aria-label="Custom context key"
                />
              )}
            </>
          ) : (
            <input
              id="override-key-text"
              className={`input mono${errors.key ? ' error' : ''}`}
              placeholder="e.g. tenant"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={saving}
              aria-label="When context key"
            />
          )}
          {selectedField ? (
            <span className="form-hint">
              {selectedField.type} · from {selectedField.source}
            </span>
          ) : key ? (
            <span className="form-hint warn">
              <Icon name="alert" size={11} />
              Not in registry — rules won&apos;t match unless added
            </span>
          ) : null}
          {errors.key && <span className="override-form-error">{errors.key}</span>}
        </div>

        {/* Operator */}
        <div className="form-field op-field">
          <label htmlFor="override-op-select">matches</label>
          <select
            id="override-op-select"
            className={`select${errors.op ? ' error' : ''}`}
            value={op}
            onChange={(e) => setOp(e.target.value)}
            disabled={saving}
            aria-label="matches"
            aria-invalid={!!errors.op}
          >
            <option value="" disabled>
              Select…
            </option>
            {operators.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.op && <span className="override-form-error">{errors.op}</span>}
        </div>

        {/* Value */}
        <div className="form-field val-field">
          <label htmlFor="override-val">value</label>
          {fieldType === 'enum' ? (
            <select
              id="override-val"
              className={`select mono${errors.val ? ' error' : ''}`}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={saving}
              aria-label="value"
              aria-invalid={!!errors.val}
            >
              <option value="" disabled>
                Select…
              </option>
              {(selectedField?.enumValues ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : fieldType === 'boolean' ? (
            <select
              id="override-val"
              className={`select mono${errors.val ? ' error' : ''}`}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={saving}
              aria-label="value"
              aria-invalid={!!errors.val}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              id="override-val"
              className={`input mono${errors.val ? ' error' : ''}`}
              placeholder={valuePlaceholder}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={saving}
              aria-label="value"
              aria-invalid={!!errors.val}
            />
          )}
          {errors.val && <span className="override-form-error">{errors.val}</span>}
        </div>

        {/* Result */}
        <div className="form-field result-field">
          <label>then return</label>
          <div className="result-seg" role="radiogroup" aria-label="Override result">
            <button
              type="button"
              role="radio"
              aria-checked={result === 'true'}
              className={`result-pill on${result === 'true' ? ' selected' : ''}`}
              onClick={() => setResult('true')}
              disabled={saving}
            >
              <span className="dot" />
              ON
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={result === 'false'}
              className={`result-pill off${result === 'false' ? ' selected' : ''}`}
              onClick={() => setResult('false')}
              disabled={saving}
            >
              <span className="dot" />
              OFF
            </button>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="form-field full">
        <label htmlFor="override-note">
          Note <span className="muted">· optional</span>
        </label>
        <input
          id="override-note"
          className="input"
          placeholder="Why this rule? Helps the next on-call."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
          aria-label="Note"
        />
      </div>

      {/* Live conflict hint (duplicate detection is handled by validation on save) */}
      {conflict && (
        <div className="form-hints">
          <div className="form-msg warn">
            <Icon name="alert" size={12} />
            <span>
              Another rule for{' '}
              <span className="mono">
                {key}={val}
              </span>{' '}
              returns the opposite result. The earlier one wins.
            </span>
          </div>
        </div>
      )}

      <div className="form-actions">
        <span className="muted form-actions-note">Changes are live — no confirm step</span>
        <span className="spacer" />
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {isEditMode ? 'Save changes' : 'Save override'}
        </Button>
      </div>
    </form>
  )
}
