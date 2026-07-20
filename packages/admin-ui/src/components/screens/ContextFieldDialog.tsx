import { useEffect, useState } from 'react'

import { contextFieldsApi } from '../../lib/api'
import { ApiError } from '../../lib/api'
import type { ContextField, FieldSource, FieldType } from '../../lib/types'
import { Button } from '../primitives/Button'
import { FormError } from '../primitives/FormError'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'
import { TextField } from '../primitives/TextField'
import { Toggle } from '../primitives/Toggle'

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/

const TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'enum', label: 'enum' },
  { value: 'boolean', label: 'boolean' },
  { value: 'number', label: 'number' },
  { value: 'version', label: 'version' },
  { value: 'date', label: 'date' },
]

const SOURCES: { value: FieldSource; label: string }[] = [
  { value: 'sdk', label: 'SDK' },
  { value: 'server', label: 'Server' },
  { value: 'computed', label: 'Computed' },
]

interface ContextFieldDialogProps {
  open: boolean
  projectId: string
  /** null = create mode; a field = edit mode (key is locked). */
  field: ContextField | null
  onClose: () => void
  onSaved: () => void
}

export function ContextFieldDialog({
  open,
  projectId,
  field,
  onClose,
  onSaved,
}: ContextFieldDialogProps) {
  const isEdit = field !== null

  const [key, setKey] = useState('')
  const [type, setType] = useState<FieldType>('string')
  const [source, setSource] = useState<FieldSource>('sdk')
  const [required, setRequired] = useState(false)
  const [description, setDescription] = useState('')
  const [example, setExample] = useState('')
  const [enumText, setEnumText] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ key?: string; enumValues?: string }>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /** Reset the form each time the dialog opens so stale edits never persist. */
  useEffect(() => {
    if (!open) return
    setKey(field?.key ?? '')
    setType(field?.type ?? 'string')
    setSource(field?.source ?? 'sdk')
    setRequired(field?.required ?? false)
    setDescription(field?.description ?? '')
    setExample(field?.example ?? '')
    setEnumText((field?.enumValues ?? []).join(', '))
    setFieldErrors({})
    setApiError(null)
  }, [open, field])

  function parseEnumValues(): string[] {
    return enumText
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }

  function validate(): boolean {
    const errors: { key?: string; enumValues?: string } = {}
    if (!isEdit) {
      if (!key.trim()) {
        errors.key = 'Key is required'
      } else if (key.length > 64) {
        errors.key = 'Key must be at most 64 characters'
      } else if (!KEY_RE.test(key)) {
        errors.key =
          'Start with a letter or underscore; use only letters, numbers, dots, hyphens, underscores'
      }
    }
    if (type === 'enum' && parseEnumValues().length === 0) {
      errors.enumValues = 'Add at least one allowed value'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setApiError(null)
    const enumValues = type === 'enum' ? parseEnumValues() : undefined
    const common = {
      type,
      source,
      required,
      description: description.trim() || undefined,
      example: example.trim() || undefined,
      enumValues,
    }
    try {
      if (isEdit && field) {
        await contextFieldsApi.update(projectId, field.id, common)
      } else {
        await contextFieldsApi.create(projectId, { key: key.trim(), ...common })
      }
      onSaved()
      onClose()
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to save context field')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header subtitle="Defines a key that targeting rules can match on. Changes take effect on the next evaluation.">
        {isEdit ? 'Edit context field' : 'New context field'}
      </Modal.Header>
      <Modal.Body>
        <FormError message={apiError} />
        <div className="ctx-form">
          <div className="ctx-form-row">
            <TextField
              label="Key"
              className="mono"
              value={key}
              onChange={setKey}
              disabled={isEdit}
              placeholder="e.g. plan"
              hint={isEdit ? 'Key is immutable — delete and recreate to rename.' : 'Used verbatim in SDK calls and rules.'}
              error={fieldErrors.key}
            />
            <Select
              label="Type"
              options={TYPE_OPTIONS}
              value={type}
              placeholder=""
              onChange={(v) => setType(v as FieldType)}
            />
          </div>

          <TextField
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="What this field means and where it comes from."
          />

          <div className="ctx-form-row">
            <div className="ctx-form-group">
              <span className="text-field-label">Source</span>
              <div className="ctx-seg" role="group" aria-label="Source">
                {SOURCES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className="ctx-seg-btn"
                    aria-pressed={source === s.value}
                    onClick={() => setSource(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="text-field-hint">
                Server &amp; computed values are not sent by the SDK.
              </span>
            </div>
            <div className="ctx-form-group">
              <span className="text-field-label">Required</span>
              <div className="ctx-required-row">
                <Toggle checked={required} onChange={setRequired} label="Required field" />
                <span className="muted">Reject evaluations missing this field.</span>
              </div>
            </div>
          </div>

          {type === 'enum' && (
            <TextField
              label="Allowed values"
              className="mono"
              value={enumText}
              onChange={setEnumText}
              placeholder="free, pro, enterprise"
              hint="Comma-separated. Rules can only compare against these values."
              error={fieldErrors.enumValues}
            />
          )}

          <TextField
            label="Example"
            className="mono"
            value={example}
            onChange={setExample}
            placeholder="pro"
            hint="Shown in the rule builder so editors know what to expect."
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add field'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
