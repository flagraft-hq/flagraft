import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'
import { Kbd } from '../primitives/Kbd'
import { flagsApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export interface CreateFlagModalProps {
  open: boolean
  projectId: string
  onClose: () => void
}

/**
 * Slugifies a flag name into a key. Lowercases, keeps letters/digits/dots,
 * turns whitespace runs into single hyphens, and trims stray separators.
 * Dots are preserved so namespaced keys like `checkout.new-cart` survive.
 */
function toFlagKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 .]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

export function CreateFlagModal({ open, projectId, onClose }: CreateFlagModalProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setKey('')
      setKeyTouched(false)
      setDescription('')
      setSaving(false)
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!keyTouched) {
      setKey(toFlagKey(value))
    }
  }

  function handleKeyChange(value: string) {
    const sanitized = toFlagKey(value)
    setKey(sanitized)
    setKeyTouched(sanitized !== '')
  }

  async function handleSubmit() {
    if (!name.trim() || !key.trim() || saving) return
    setSaving(true)
    try {
      const res = await flagsApi.create(projectId, {
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || undefined,
      })
      toast.push({ title: 'Flag created', variant: 'success' })
      onClose()
      navigate('/flags/' + res.data.key)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred'
      toast.push({ title: msg, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const disabled = !name.trim() || !key.trim() || saving

  return (
    <Modal open={open} onClose={onClose} size="lg" titleId="create-flag-modal-title">
      <Modal.Header
        id="create-flag-modal-title"
        subtitle="Flags start off in every environment. You can change defaults below."
      >
        Create flag
      </Modal.Header>
      <Modal.Body>
        <div
          className="create-flag-form"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit()
          }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. New cart experience"
            hint="Human-readable. Shown in the admin UI."
            autoFocus
          />
          <TextField
            label="Key · immutable"
            value={key}
            onChange={handleKeyChange}
            placeholder="checkout.new-cart"
            hint={`Used in your code: client.isEnabled('${key || 'flag-key'}')`}
            style={{ fontFamily: 'var(--font-mono)' }}
          />

          <div className="text-field">
            <label className="text-field-label" htmlFor="create-flag-desc">
              Description
            </label>
            <textarea
              id="create-flag-desc"
              className="text-field-input create-flag-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control? Who owns it? When can it be removed?"
              rows={3}
            />
          </div>

          <div className="snippet-preview">
            <div className="snippet-label">Snippet preview</div>
            <pre className="snippet-code">{`import { flagraft } from '@flagraft/sdk';

const on = await flagraft.isEnabled('${key || 'your-flag-key'}', {
  userId: ctx.userId,
});`}</pre>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <span className="spacer" />
        <span className="create-flag-kbd-hint muted">
          <Kbd keys={['⌘']} /> <Kbd keys={['↵']} /> to create
        </span>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={disabled}>
          Create flag
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
