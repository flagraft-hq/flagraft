import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Description, Input, Label, TextArea, TextField } from '@heroui/react'
import { Dialog } from '../primitives/Dialog'
import { Kbd } from '../primitives/Kbd'
import { flagsApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { useProject } from '../../contexts/ProjectContext'

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
  const { activeProject } = useProject()
  const requireDescription = activeProject?.settings?.flagDefaults?.requireDescription ?? false
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
    if (requireDescription && !description.trim()) return
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

  const disabled =
    !name.trim() || !key.trim() || saving || (requireDescription && !description.trim())

  return (
    <Dialog
      className="flags-dialog"
      size="lg"
      open={open}
      onClose={onClose}
      title="Create flag"
      subtitle="Flags start off in every environment. You can change defaults below."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <span className="spacer" />
          <span className="create-flag-kbd-hint muted">
            <Kbd keys={['⌘']} /> <Kbd keys={['↵']} /> to create
          </span>
          <Button variant="primary" onClick={() => void handleSubmit()} isDisabled={disabled}>
            Create flag
          </Button>
        </>
      }
    >
      <div
        className="dc-form create-flag-form"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit()
        }}
      >
        <TextField value={name} onChange={handleNameChange} autoFocus isRequired>
          <Label>Name · required</Label>
          <Input placeholder="e.g. New cart experience" />
          <Description>Human-readable. Shown in the admin UI.</Description>
        </TextField>

        <TextField value={key} onChange={handleKeyChange} isRequired>
          <Label>Key · immutable · required</Label>
          <Input className="mono" placeholder="checkout.new-cart" />
          <Description>{`Used in your code: client.isEnabled('${key || 'flag-key'}')`}</Description>
        </TextField>

        <TextField value={description} onChange={setDescription} isRequired={requireDescription}>
          <Label>Description{requireDescription ? ' · required' : ''}</Label>
          <TextArea
            rows={3}
            placeholder="What does this flag control? Who owns it? When can it be removed?"
          />
        </TextField>

        <div className="snippet-preview">
          <div className="snippet-label">Snippet preview</div>
          <pre className="snippet-code">{`import { flagraft } from '@flagraft/sdk';

const on = await flagraft.isEnabled('${key || 'your-flag-key'}', {
  userId: ctx.userId,
});`}</pre>
        </div>
      </div>
    </Dialog>
  )
}
