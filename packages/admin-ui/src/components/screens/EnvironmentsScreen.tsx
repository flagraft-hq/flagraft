import { useState, useEffect } from 'react'
import { Button, Chip, Description, Input, Label, Switch, TextField, Tooltip } from '@heroui/react'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useEnvironments } from '../../hooks/useEnvironments'
import type { EnvWithStats } from '../../hooks/useEnvironments'
import { usePermissions } from '../../hooks/usePermissions'
import { environmentsApi, apiBaseUrl } from '../../lib/api'
import { CopyButton } from '../primitives/CopyButton'
import { Denied } from '../primitives/Denied'
import { Dialog } from '../primitives/Dialog'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'
import { ErrorState } from '../primitives/ErrorState'
import { MAX_ENVIRONMENTS_PER_PROJECT } from '../../lib/limits'

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
  const { canProjectAdmin } = usePermissions()
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

  /** The backend refuses past this, so stop the user before the round trip. */
  const atLimit = environments.length >= MAX_ENVIRONMENTS_PER_PROJECT

  if (loading) {
    return <div className="env-loading">Loading...</div>
  }

  if (error) {
    return <ErrorState title="Failed to load environments" message={error} onRetry={refetch} />
  }

  return (
    <div className="env-screen dc">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Environments</h1>
          <p className="page-header-sub">
            Flag state is scoped per environment. Each environment can have its own keys and flag
            values. A project can have up to {MAX_ENVIRONMENTS_PER_PROJECT}.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="limit-note">
            {environments.length} of {MAX_ENVIRONMENTS_PER_PROJECT} used
          </span>
          {atLimit ? (
            <Tooltip>
              <Button variant="primary" isDisabled>
                <Icon name="plus" size={14} />
                New environment
              </Button>
              <Tooltip.Content>
                Limit reached — delete an environment to add another.
              </Tooltip.Content>
            </Tooltip>
          ) : (
            <Denied when={!canProjectAdmin} reason="Only owners and admins can manage environments">
              <Button
                variant="primary"
                isDisabled={!canProjectAdmin}
                onClick={() => setShowNew(true)}
              >
                <Icon name="plus" size={14} />
                New environment
              </Button>
            </Denied>
          )}
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
                  <span>
                    <Chip className="env-protected" size="sm">
                      <Icon name="shield" size={10} /> protected
                    </Chip>
                  </span>
                </Tip>
              )}
              <span className="spacer" />
              <Tooltip>
                <Button
                  className="dc-icon-btn"
                  variant="ghost"
                  isIconOnly
                  aria-label="Edit environment"
                  isDisabled={!canProjectAdmin}
                  onClick={() => setEditing(env)}
                >
                  <Icon name="edit" size={14} />
                </Button>
                <Tooltip.Content>
                  {canProjectAdmin
                    ? 'Edit environment'
                    : 'Only owners and admins can manage environments'}
                </Tooltip.Content>
              </Tooltip>
              {!env.protected && (
                <Tooltip>
                  <Button
                    className="dc-icon-btn env-delete-btn"
                    variant="ghost"
                    isIconOnly
                    aria-label="Delete environment"
                    isDisabled={!canProjectAdmin}
                    onClick={() => setDeleteTarget(env)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                  <Tooltip.Content>
                    {canProjectAdmin
                      ? 'Delete environment'
                      : 'Only owners and admins can manage environments'}
                  </Tooltip.Content>
                </Tooltip>
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

      <Dialog
        className="env-dialog"
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete environment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} isDisabled={deleting}>
              Cancel
            </Button>
            <span className="spacer" />
            <Button
              variant="danger"
              onClick={() => void handleDelete()}
              isDisabled={deleting}
              isPending={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteTarget?.name}</strong>? This removes its flag state and keys and
          cannot be undone.
        </p>
      </Dialog>
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
    <Dialog
      className="env-dialog"
      size="lg"
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit environment' : 'New environment'}
      subtitle={isEdit ? undefined : 'A new environment starts with all flags off.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <span className="spacer" />
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            isDisabled={disabled}
            isPending={saving}
          >
            {isEdit ? 'Save changes' : 'Create environment'}
          </Button>
        </>
      }
    >
      <div className="dc-form">
        <FormError message={submitError} />
        <TextField value={name} onChange={handleNameChange} autoFocus isRequired>
          <Label>Name</Label>
          <Input placeholder="e.g. Preview" />
        </TextField>
        <TextField
          value={slug}
          onChange={(v) => {
            setSlugTouched(true)
            setSlug(toSlug(v))
          }}
          isDisabled={isEdit}
          isInvalid={slugTaken}
          isRequired
        >
          <Label>Slug</Label>
          <Input className="mono" placeholder="preview" />
          <Description>
            {slugTaken
              ? 'An environment with this slug already exists.'
              : isEdit
                ? 'The slug is immutable once created.'
                : 'Used in URLs and SDK config. Lowercase, no spaces.'}
          </Description>
        </TextField>
        <div className="dc-form-field">
          <span className="dc-form-label">Protected</span>
          <div className="env-form-protected">
            <Switch isSelected={isProtected} onChange={setIsProtected} aria-label="Protected">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            <span className="muted">Require confirmation for changes</span>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
