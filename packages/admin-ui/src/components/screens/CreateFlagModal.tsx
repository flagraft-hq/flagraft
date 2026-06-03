import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'
import { flagsApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export interface CreateFlagModalProps {
  open: boolean
  projectId: string
  onClose: () => void
}

function toFlagKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
    <Modal open={open} onClose={onClose} titleId="create-flag-modal-title">
      <Modal.Header id="create-flag-modal-title">New feature flag</Modal.Header>
      <Modal.Body>
        <TextField label="Name" value={name} onChange={handleNameChange} placeholder="My Feature" />
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          placeholder="my-feature"
          hint="Unique identifier used in SDK calls. Lowercase letters, numbers, hyphens."
        />
        <TextField
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Optional description"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={disabled}>
          Create flag
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
