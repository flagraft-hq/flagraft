import React, { useState } from 'react'
import { TextField } from '../primitives/TextField'
import { Button } from '../primitives/Button'
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

  // Derive selected field type
  const selectedField = contextFields.find((f) => f.key === key)
  const fieldType: FieldType = selectedField?.type ?? 'string'
  const operators = OPS_BY_TYPE[fieldType] ?? OPS_BY_TYPE['string']

  const handleKeySelectChange = (value: string) => {
    setKeySelectValue(value)
    if (value === OTHER_KEY) {
      setKey(customKey)
    } else {
      setKey(value)
    }
    // Reset op when key changes
    setOp('')
    setVal('')
  }

  const handleCustomKeyChange = (value: string) => {
    setCustomKey(value)
    setKey(value)
  }

  const handleOpChange = (value: string) => {
    setOp(value)
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
      await onSave({
        env,
        key,
        op,
        val,
        result: result === 'true',
        note,
      })
    } finally {
      setSaving(false)
    }
  }

  const keySelectOptions = [
    ...contextFields.map((f) => ({ value: f.key, label: f.key })),
    ...(contextFields.length > 0 ? [{ value: OTHER_KEY, label: 'Other (type key)' }] : []),
  ]

  const operatorOptions = operators.map((o) => ({ value: o.value, label: o.label }))

  const resultOptions = [
    { value: 'true', label: 'Enabled' },
    { value: 'false', label: 'Disabled' },
  ]

  const boolOptions = [
    { value: 'true', label: 'true' },
    { value: 'false', label: 'false' },
  ]

  const showCustomKeyInput = keySelectValue === OTHER_KEY || contextFields.length === 0

  return (
    <form
      className="override-form"
      onSubmit={(e) => {
        void handleSubmit(e)
      }}
      noValidate
    >
      <div className="override-form-title">{isEditMode ? 'Edit Override' : 'Add Override'}</div>

      <div className="override-form-row">
        {/* Context Key */}
        <div className="override-form-field">
          {contextFields.length > 0 ? (
            <>
              <label className="override-form-label" htmlFor="override-key-select">
                Context Key
              </label>
              <select
                id="override-key-select"
                className={`select-input${errors.key ? ' error' : ''}`}
                value={keySelectValue}
                onChange={(e) => handleKeySelectChange(e.target.value)}
                disabled={saving}
                aria-label="Context Key"
                aria-invalid={!!errors.key}
              >
                <option value="" disabled>
                  Select...
                </option>
                {keySelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {showCustomKeyInput && (
                <TextField
                  placeholder="Enter context key"
                  value={customKey}
                  onChange={handleCustomKeyChange}
                  disabled={saving}
                />
              )}
            </>
          ) : (
            <>
              <label className="override-form-label" htmlFor="override-key-text">
                Context Key
              </label>
              <TextField
                id="override-key-text"
                placeholder="Enter context key"
                value={key}
                onChange={setKey}
                disabled={saving}
                aria-label="Context Key"
              />
            </>
          )}
          {errors.key && <span className="override-form-error">{errors.key}</span>}
        </div>

        {/* Operator */}
        <div className="override-form-field">
          <label className="override-form-label" htmlFor="override-op-select">
            Operator
          </label>
          <select
            id="override-op-select"
            className={`select-input${errors.op ? ' error' : ''}`}
            value={op}
            onChange={(e) => handleOpChange(e.target.value)}
            disabled={saving}
            aria-label="Operator"
            aria-invalid={!!errors.op}
          >
            <option value="" disabled>
              Select...
            </option>
            {operatorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.op && <span className="override-form-error">{errors.op}</span>}
        </div>

        {/* Value */}
        <div className="override-form-field">
          {fieldType === 'boolean' ? (
            <>
              <label className="override-form-label" htmlFor="override-val-bool">
                Value
              </label>
              <select
                id="override-val-bool"
                className={`select-input${errors.val ? ' error' : ''}`}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                disabled={saving}
                aria-label="Value"
                aria-invalid={!!errors.val}
              >
                <option value="" disabled>
                  Select...
                </option>
                {boolOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="override-form-label" htmlFor="override-val-text">
                Value
              </label>
              <TextField
                id="override-val-text"
                placeholder="Value"
                value={val}
                onChange={setVal}
                disabled={saving}
                aria-label="Value"
              />
            </>
          )}
          {errors.val && <span className="override-form-error">{errors.val}</span>}
        </div>

        {/* Result */}
        <div className="override-form-field">
          <label className="override-form-label" htmlFor="override-result-select">
            Result
          </label>
          <select
            id="override-result-select"
            className="select-input"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            disabled={saving}
            aria-label="Result"
          >
            {resultOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="override-form-field">
        <label className="override-form-label" htmlFor="override-note-text">
          Note
        </label>
        <TextField
          id="override-note-text"
          placeholder="Optional note"
          value={note}
          onChange={setNote}
          disabled={saving}
          aria-label="Note"
        />
      </div>

      <div className="override-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {isEditMode ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  )
}
