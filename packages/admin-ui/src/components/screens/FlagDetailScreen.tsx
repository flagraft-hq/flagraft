import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { flagsApi } from '../../lib/api'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import type { Flag } from '../../lib/types'
import { Button } from '../primitives/Button'
import { ErrorState } from '../primitives/ErrorState'
import { Icon } from '../primitives/Icon'
import { Toggle } from '../primitives/Toggle'
import { Modal } from '../primitives/Modal'
import { Badge } from '../primitives/Badge'
import { ContextOverridesSection } from './ContextOverridesSection'
import { TextField } from '../primitives/TextField'

type TabId = 'environments' | 'usage' | 'history'

interface EditFlagModalProps {
  open: boolean
  flag: Flag
  projectId: string
  onClose: () => void
  onSaved: (updated: Flag) => void
}

function EditFlagModal({ open, flag, projectId, onClose, onSaved }: EditFlagModalProps) {
  const [name, setName] = useState(flag.name)
  const [description, setDescription] = useState(flag.description)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  /** Reset fields whenever the modal opens so stale edits do not persist. */
  useEffect(() => {
    if (open) {
      setName(flag.name)
      setDescription(flag.description)
    }
  }, [open, flag.name, flag.description])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await flagsApi.update(projectId, flag.key, { name, description })
      onSaved(res.data)
      toast.push({ title: 'Flag updated', variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed'
      toast.push({ title: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header>Edit flag</Modal.Header>
      <Modal.Body>
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label="Description" value={description} onChange={setDescription} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => void handleSave()}>
          Save changes
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function isProductionEnv(env: string): boolean {
  return env === 'production' || env.endsWith('-production') || env.endsWith('_production')
}

function EnvironmentsTab({
  flag,
  projectId,
  flagKey,
  envKeys,
  activeEnv,
  onToggled,
}: {
  flag: Flag
  projectId: string
  flagKey: string
  envKeys: string[]
  activeEnv: string
  onToggled: () => void
}) {
  const toast = useToast()
  const [confirmState, setConfirmState] = useState<{ env: string; checked: boolean } | null>(null)

  const executeToggle = (env: string, newValue: boolean) => {
    void flagsApi
      .toggle(projectId, flagKey, env, newValue)
      .then(() => {
        toast.push({ title: `${env} toggled`, variant: 'success' })
        onToggled()
      })
      .catch(() => {
        toast.push({ title: 'Failed to toggle environment', variant: 'error' })
      })
  }

  const handleToggle = (env: string, newValue: boolean) => {
    if (isProductionEnv(env)) {
      setConfirmState({ env, checked: newValue })
    } else {
      executeToggle(env, newValue)
    }
  }

  const handleConfirm = () => {
    if (confirmState) {
      executeToggle(confirmState.env, confirmState.checked)
      setConfirmState(null)
    }
  }

  const handleCancel = () => {
    setConfirmState(null)
  }

  return (
    <div>
      <div className="env-cards-grid">
        {envKeys.map((env) => {
          const envState = flag.state[env]
          const isOn = envState?.on ?? false
          const overrideCount = envState?.overrides ?? 0
          return (
            <div key={env} className="env-card">
              <span className="env-badge">{env}</span>
              <Toggle
                checked={isOn}
                onChange={(newValue) => handleToggle(env, newValue)}
                variant={env === 'production' ? 'production' : 'default'}
              />
              <div>{isOn ? 'Enabled' : 'Disabled'}</div>
              <div>{overrideCount > 0 ? `+${overrideCount} overrides` : 'No overrides'}</div>
            </div>
          )
        })}
      </div>
      <ContextOverridesSection projectId={projectId} flagKey={flagKey} env={activeEnv} />

      <Modal open={confirmState !== null} onClose={handleCancel}>
        <Modal.Header>{confirmState?.checked ? 'Enable' : 'Disable'} in Production?</Modal.Header>
        <Modal.Body>
          <p>
            {confirmState?.checked ? 'Enable' : 'Disable'} <strong>{flag.name}</strong> in <strong>{confirmState?.env}</strong>? This will
            affect production traffic.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            {confirmState?.checked ? 'Enable' : 'Disable'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export function FlagDetailScreen() {
  const { key: flagKey } = useParams<{ key: string }>()
  const navigate = useNavigate()
  const { activeProject, activeEnv } = useProject()
  const toast = useToast()

  const [flag, setFlag] = useState<Flag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('environments')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const projectId = activeProject?.id

  const fetchFlag = useCallback(async () => {
    if (!projectId || !flagKey) return
    setLoading(true)
    setError(null)
    try {
      const res = await flagsApi.get(projectId, flagKey)
      setFlag(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flag')
    } finally {
      setLoading(false)
    }
  }, [projectId, flagKey])

  useEffect(() => {
    void fetchFlag()
  }, [fetchFlag])

  if (!activeProject) {
    return <div className="flag-detail-no-project">No project selected</div>
  }

  if (loading) {
    return <div className="flag-detail-loading">Loading...</div>
  }

  if (error) {
    return <ErrorState title="Failed to load flag" message={error} onRetry={() => void fetchFlag} />
  }

  if (!flag) return null

  const envKeys = Object.keys(flag.state ?? {})

  const totalOverrides = Object.values(flag.state ?? {}).reduce(
    (sum, envState) => sum + (envState?.overrides ?? 0),
    0,
  )

  const handleCopyKey = () => {
    navigator.clipboard
      .writeText(flag.key)
      .then(() => toast.push({ title: 'Key copied', variant: 'success' }))
      .catch(() => toast.push({ title: 'Failed to copy key', variant: 'error' }))
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await flagsApi.delete(activeProject.id, flag.key)
      toast.push({ title: 'Flag deleted', variant: 'success' })
      navigate('/flags')
    } catch {
      toast.push({ title: 'Failed to delete flag', variant: 'error' })
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="flag-detail-screen">
      <div className="detail-page-header">
        <nav className="detail-breadcrumb">
          <span>Flags</span>
          <Icon name="chevronRight" size={12} />
          <span>{flag.name}</span>
        </nav>
        <h1 className="detail-title">{flag.name}</h1>
        <div className="detail-actions">
          <Button variant="ghost" size="sm" leftIcon="copy" onClick={handleCopyKey}>
            Copy key
          </Button>
          <Button variant="ghost" size="sm" leftIcon="code">
            SDK snippet
          </Button>
          <Button variant="ghost" size="sm" leftIcon="edit" onClick={() => setShowEditModal(true)}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon="trash"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="detail-meta">
        <span className="flag-key-chip">
          <Icon name="flag" size={12} />
          {flag.key}
        </span>
        <p className="flag-desc">{flag.description}</p>
        <div className="detail-meta-row">
          <span>Owner: {flag.author || 'System'}</span>
          <span>Created: {new Date(flag.created).toLocaleDateString()}</span>
          <span>Overrides: {totalOverrides}</span>
          <span>
            Tags:{' '}
            {(flag.tags ?? []).length > 0 ? (flag.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>) : 'None'}
          </span>
        </div>
      </div>

      <div className="detail-tabs" role="tablist">
        <button
          id="tab-environments"
          role="tab"
          aria-selected={activeTab === 'environments'}
          aria-controls="panel-environments"
          className={`detail-tab${activeTab === 'environments' ? ' detail-tab--active' : ''}`}
          onClick={() => setActiveTab('environments')}
        >
          Environments &amp; overrides
          {totalOverrides > 0 && <Badge>{totalOverrides}</Badge>}
        </button>
        <button
          id="tab-usage"
          role="tab"
          aria-selected={activeTab === 'usage'}
          aria-controls="panel-usage"
          className={`detail-tab${activeTab === 'usage' ? ' detail-tab--active' : ''}`}
          onClick={() => setActiveTab('usage')}
        >
          Usage
        </button>
        <button
          id="tab-history"
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="panel-history"
          className={`detail-tab${activeTab === 'history' ? ' detail-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="detail-tab-content">
        {activeTab === 'environments' && (
          <div id="panel-environments" role="tabpanel" aria-labelledby="tab-environments">
            <EnvironmentsTab
              flag={flag}
              projectId={activeProject.id}
              flagKey={flag.key}
              envKeys={envKeys}
              activeEnv={activeEnv}
              onToggled={() => {
                void fetchFlag()
              }}
            />
          </div>
        )}
        {activeTab === 'usage' && (
          <div
            id="panel-usage"
            role="tabpanel"
            aria-labelledby="tab-usage"
            className="tab-placeholder"
          >
            Usage data coming soon.
          </div>
        )}
        {activeTab === 'history' && (
          <div
            id="panel-history"
            role="tabpanel"
            aria-labelledby="tab-history"
            className="tab-placeholder"
          >
            History coming soon.
          </div>
        )}
      </div>

      <EditFlagModal
        open={showEditModal}
        flag={flag}
        projectId={activeProject.id}
        onClose={() => setShowEditModal(false)}
        onSaved={(updated) => {
          setFlag(updated)
          setShowEditModal(false)
        }}
      />

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <Modal.Header>
          <span>Delete flag</span>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete <strong>{flag.name}</strong>? This action cannot be
            undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void handleDelete()
            }}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
