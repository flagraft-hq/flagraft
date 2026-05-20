import { useState, useEffect } from 'react'
import axios from 'axios'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'
import { projectsApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import type { Project } from '../../lib/types'

export interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreated: (project: Project) => void
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setSaving(false)
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(toSlug(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlug(toSlug(value))
    setSlugTouched(true)
  }

  async function handleSubmit() {
    if (!name.trim() || !slug.trim() || saving) return
    setSaving(true)
    try {
      const res = await projectsApi.create({ name: name.trim(), slug: slug.trim() })
      toast.push({ title: 'Project created', variant: 'success' })
      onCreated(res.data)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        toast.push({ title: 'Project creation requires a root admin key.', variant: 'error' })
      } else {
        const msg = err instanceof Error ? err.message : 'An unknown error occurred'
        toast.push({ title: msg, variant: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  const disabled = !name.trim() || !slug.trim() || saving

  return (
    <Modal open={open} onClose={onClose} titleId="create-project-modal-title">
      <Modal.Header id="create-project-modal-title">New project</Modal.Header>
      <Modal.Body>
        <TextField
          label="Name"
          value={name}
          onChange={handleNameChange}
          placeholder="My project"
        />
        <TextField
          label="Slug"
          value={slug}
          onChange={handleSlugChange}
          placeholder="my-project"
          hint="Used in URLs and API calls"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={disabled}>
          Create project
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
