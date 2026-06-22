import { useState, useEffect } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useEnvironments } from '../../hooks/useEnvironments'
import type { EnvWithStats } from '../../hooks/useEnvironments'
import { environmentsApi } from '../../lib/api'
import { Button } from '../primitives/Button'
import { CopyButton } from '../primitives/CopyButton'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
import { Badge } from '../primitives/Badge'
import { Modal } from '../primitives/Modal'
import { Toggle } from '../primitives/Toggle'
import { TextField } from '../primitives/TextField'
import { Tip } from '../primitives/Tip'
import { ErrorState } from '../primitives/ErrorState'

/** Public SDK base URL shown per environment (display value, not the admin API). */
function baseUrlFor(slug: string): string {
  return `api.flagraft.io/v1/${slug}`
}

/** Slugify a name for the env slug field: lowercase, no spaces. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function EnvironmentsScreen() {
  const { activeProject } = useProject()

  if (!activeProject) {
    return <div className="env-empty-project">No project selected</div>
  }

  return <EnvironmentsScreenInner projectId={activeProject.id} />
}

function EnvironmentsScreenInner({ projectId }: { projectId: string }) {
  const { environments, loading, error, refetch } = useEnvironments(projectId)
  const { refetchEnvironments } = useProject()
  const toast = useToast()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<EnvWithStats | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnvWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Refresh both this screen's cards and the app-wide env list (topbar, flags). */
  function refetchAll() {
    refetch()
    refetchEnvironments()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await environmentsApi.delete(projectId, deleteTarget.id)
      toast.push({ title: `Environment "${deleteTarget.name}" deleted`, variant: 'success' })
      setDeleteTarget(null)
      refetchAll()
    } catch (err: unknown) {
      toast.push({
        title: err instanceof Error ? err.message : 'Failed to delete environment',
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="env-loading">Loading...</div>
  }

  if (error) {
    return <ErrorState title="Failed to load environments" message={error} onRetry={refetch} />
  }

  return (
    <div className="env-screen">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Environments</h1>
          <p className="page-header-sub">
            Flag state is scoped per environment. Each environment can have its own keys and
            overrides.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" leftIcon="plus" onClick={() => setShowNew(true)}>
            New environment
          </Button>
        </div>
      </div>

      <div className="env-grid">
        {environments.map((env) => (
          <div key={env.slug} className="env-card-lg">
            <div className="env-card-lg-head">
              <span className={`env-pill env-pill-${env.color}`}>
                <span className="dot" />
                {env.name}
              </span>
              {env.protected && (
                <Tip tip="Protected — destructive changes require confirmation">
                  <Badge variant="danger">
                    <Icon name="shield" size={10} /> protected
                  </Badge>
                </Tip>
              )}
              <span className="spacer" />
              <Tip tip="Edit environment">
                <button
                  className="icon-btn"
                  aria-label="Edit environment"
                  onClick={() => setEditing(env)}
                >
                  <Icon name="edit" size={14} />
                </button>
              </Tip>
              {!env.protected && (
                <Tip tip="Delete environment">
                  <button
                    className="icon-btn"
                    aria-label="Delete environment"
                    onClick={() => setDeleteTarget(env)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </Tip>
              )}
            </div>

            <div className="env-card-slug mono">/{env.slug}</div>

            <div className="env-stats">
              <div className="env-stat">
                <div className="env-stat-label">Flags</div>
                <div className="env-stat-value num">{env.flags}</div>
              </div>
              <div className="env-stat">
                <div className="env-stat-label">On by default</div>
                <div className="env-stat-value num">{env.defaultOn}</div>
              </div>
              <div className="env-stat">
                <div className="env-stat-label">Client keys</div>
                <div className="env-stat-value num">{env.clientKeys ?? '—'}</div>
              </div>
            </div>

            <div className="env-card-foot">
              <span className="muted env-baseurl-label">Base URL</span>
              <code className="mono env-baseurl">{baseUrlFor(env.slug)}</code>
              <span className="spacer" />
              <CopyButton
                value={baseUrlFor(env.slug)}
                ariaLabel={`Copy base URL for ${env.name}`}
              />
            </div>
          </div>
        ))}
      </div>

      <EnvFormModal
        open={showNew}
        mode="create"
        projectId={projectId}
        existingSlugs={environments.map((e) => e.slug)}
        onClose={() => setShowNew(false)}
        onSaved={refetchAll}
      />
      <EnvFormModal
        open={editing !== null}
        mode="edit"
        env={editing}
        projectId={projectId}
        existingSlugs={environments.map((e) => e.slug)}
        onClose={() => setEditing(null)}
        onSaved={refetchAll}
      />

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <Modal.Header>Delete environment</Modal.Header>
        <Modal.Body>
          <p>
            Delete <strong>{deleteTarget?.name}</strong>? This removes its flag state and keys and
            cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

interface EnvFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  env?: EnvWithStats | null
  projectId: string
  existingSlugs: string[]
  onClose: () => void
  onSaved: () => void
}

function EnvFormModal({
  open,
  mode,
  env,
  projectId,
  existingSlugs,
  onClose,
  onSaved,
}: EnvFormModalProps) {
  const isEdit = mode === 'edit'
  const toast = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [isProtected, setIsProtected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(env?.name ?? '')
      setSlug(env?.slug ?? '')
      setSlugTouched(false)
      setIsProtected(env?.protected ?? false)
      setSaving(false)
      setSubmitError(null)
    }
  }, [open, env])

  function handleNameChange(value: string) {
    setName(value)
    if (!isEdit && !slugTouched) {
      setSlug(toSlug(value))
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !slug.trim() || saving) return
    setSaving(true)
    setSubmitError(null)
    try {
      if (isEdit && env) {
        await environmentsApi.update(projectId, env.id, {
          name: name.trim(),
          protected: isProtected,
        })
        toast.push({ title: 'Environment updated', variant: 'success' })
      } else {
        await environmentsApi.create(projectId, {
          name: name.trim(),
          slug: slug.trim(),
          protected: isProtected,
        })
        toast.push({ title: 'Environment created', variant: 'success' })
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save environment'
      setSubmitError(message)
      toast.push({ title: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const slugTaken = !isEdit && existingSlugs.includes(slug.trim())
  const disabled = !name.trim() || !slug.trim() || slugTaken || saving

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header
        subtitle={
          isEdit ? undefined : 'A new environment starts with all flags off and no overrides.'
        }
      >
        {isEdit ? 'Edit environment' : 'New environment'}
      </Modal.Header>
      <Modal.Body>
        <div className="env-form">
          <FormError message={submitError} />
          <TextField
            label="Name"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Preview"
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(v) => {
              setSlugTouched(true)
              setSlug(toSlug(v))
            }}
            placeholder="preview"
            disabled={isEdit}
            style={{ fontFamily: 'var(--font-mono)' }}
            hint={
              slugTaken
                ? 'An environment with this slug already exists.'
                : isEdit
                  ? 'The slug is immutable once created.'
                  : 'Used in URLs and SDK config. Lowercase, no spaces.'
            }
            error={slugTaken ? 'An environment with this slug already exists.' : undefined}
          />
          <div className="env-form-field">
            <span className="env-form-label">Protected</span>
            <div className="env-form-protected">
              <Toggle checked={isProtected} onChange={setIsProtected} />
              <span className="muted">Require confirmation for changes</span>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <span className="spacer" />
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={disabled}>
          {isEdit ? 'Save changes' : 'Create environment'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
