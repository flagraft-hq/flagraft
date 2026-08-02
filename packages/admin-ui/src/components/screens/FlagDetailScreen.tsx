import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { flagsApi } from '../../lib/api'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import type { Flag } from '../../lib/types'
import { Button } from '../primitives/Button'
import { ErrorState } from '../primitives/ErrorState'
import { CopyButton } from '../primitives/CopyButton'
import { Icon } from '../primitives/Icon'
import { Toggle } from '../primitives/Toggle'
import { Modal } from '../primitives/Modal'
import { TextField } from '../primitives/TextField'
import { useContextFields } from '../../hooks/useContextFields'
import { EnvStrategies } from './EnvStrategies'

type TabId = 'environments' | 'usage' | 'history'

/** Maps an environment to its accent color (matches the env dots elsewhere). */
function envColor(env: string): string {
  if (env === 'production' || env.endsWith('production')) return 'red'
  if (env === 'staging' || env.endsWith('staging')) return 'amber'
  if (env === 'development' || env.endsWith('development')) return 'teal'
  return 'slate'
}

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
      <Modal.Header subtitle={`Update configuration for feature flag: ${flag.key}`}>
        Edit flag
      </Modal.Header>
      <Modal.Body>
        <div className="edit-flag-form">
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. New Cart Experience"
            hint="The display name for the feature flag."
          />
          <div className="text-field">
            <label className="text-field-label" htmlFor="edit-flag-description">
              Description
            </label>
            <textarea
              id="edit-flag-description"
              className="text-field-input text-field-textarea"
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this feature flag does..."
              rows={3}
            />
            <span className="text-field-hint">
              Provide context for your team members on the purpose or scope of this flag.
            </span>
          </div>
        </div>
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

interface SdkSnippetModalProps {
  open: boolean
  flag: Flag
  onClose: () => void
}

type SdkTab = 'node' | 'react' | 'go' | 'python' | 'curl'

function SdkSnippetModal({ open, flag, onClose }: SdkSnippetModalProps) {
  const [activeTab, setActiveTab] = useState<SdkTab>('node')

  const snippets: Record<SdkTab, { lang: string; code: string }> = {
    node: {
      lang: 'javascript',
      code: `// Server-side, Node 20+
import { Flagraft } from '@flagraft/sdk';

const ff = new Flagraft({ apiKey: process.env.FLAGRAFT_CLIENT_KEY });

if (await ff.isEnabled('${flag.key}', { userId })) {
  // new path
} else {
  // legacy path
}`,
    },
    react: {
      lang: 'typescript',
      code: `// React client-side
import { useFlag } from '@flagraft/react';

function MyComponent() {
  const isEnabled = useFlag('${flag.key}', { userId });

  return isEnabled ? <NewFeature /> : <OldFeature />;
}`,
    },
    go: {
      lang: 'go',
      code: `// Go SDK
import "github.com/flagraft/flagraft-go"

client := flagraft.NewClient(os.Getenv("FLAGRAFT_CLIENT_KEY"))

if client.IsEnabled("${flag.key}", flagraft.Context{"userId": userId}) {
    // new path
} else {
    // legacy path
}`,
    },
    python: {
      lang: 'python',
      code: `# Python SDK
from flagraft import Flagraft
import os

ff = Flagraft(os.environ.get("FLAGRAFT_CLIENT_KEY"))

if ff.is_enabled("${flag.key}", {"userId": user_id}):
    # new path
else:
    # legacy path`,
    },
    curl: {
      lang: 'bash',
      code: `# HTTP API
curl -X POST https://api.flagraft.com/v1/eval \\
  -H "Authorization: Bearer YOUR_CLIENT_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "flagKey": "${flag.key}",
    "context": { "userId": "123" }
  }'`,
    },
  }

  const tabs: { id: SdkTab; label: string; isComingSoon?: boolean }[] = [
    { id: 'node', label: 'Node.js' },
    { id: 'react', label: 'React' },
    { id: 'go', label: 'Go', isComingSoon: true },
    { id: 'python', label: 'Python', isComingSoon: true },
    { id: 'curl', label: 'cURL' },
  ]

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header subtitle={`Integration snippet for feature flag: ${flag.key}`}>
        SDK snippets
      </Modal.Header>
      <Modal.Body>
        <div className="sdk-modal-layout">
          <div className="sdk-modal-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sdk-modal-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.isComingSoon && <span className="sdk-modal-coming-soon-badge">soon</span>}
              </button>
            ))}
          </div>
          <div className="sdk-modal-code-container">
            {activeTab === 'go' || activeTab === 'python' ? (
              <div className="sdk-modal-coming-soon-state">
                <div className="coming-soon-icon-wrap">
                  <Icon name="bolt" size={24} />
                </div>
                <h3>{tabs.find((t) => t.id === activeTab)?.label} SDK is coming soon</h3>
                <p>
                  We are actively building our official{' '}
                  {tabs.find((t) => t.id === activeTab)?.label} SDK. In the meantime, you can
                  evaluate feature flags using direct HTTP calls.
                </p>
                <div className="coming-soon-alternative">
                  <span>Alternative integration:</span>
                  <button type="button" className="link-btn" onClick={() => setActiveTab('curl')}>
                    View cURL snippet &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="sdk-modal-code-header">
                  <span className="sdk-modal-lang-label">{snippets[activeTab].lang}</span>
                  <CopyButton key={activeTab} value={snippets[activeTab].code} label="Copy code" />
                </div>
                <pre className="sdk-modal-code">
                  <code>{snippets[activeTab].code}</code>
                </pre>
              </>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>
          Close
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
  onToggled,
}: {
  flag: Flag
  projectId: string
  flagKey: string
  envKeys: string[]
  onToggled: () => void
}) {
  const toast = useToast()
  const { environments } = useProject()
  const { fields: contextFields } = useContextFields(projectId)
  /** Display the environment's real name; fall back to the slug if unknown. */
  const nameFor = (slug: string) => environments.find((e) => e.slug === slug)?.name ?? slug
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
          return (
            <div key={env} className="env-card">
              <div className="env-card-head">
                <span className={`env-badge env-badge-${envColor(env)}`}>
                  <span className="dot" />
                  {nameFor(env)}
                </span>
                <span className="spacer" />
                <Toggle
                  checked={isOn}
                  size="lg"
                  onChange={(newValue) => handleToggle(env, newValue)}
                />
              </div>
              <div className="env-card-state">
                <span className={isOn ? 'env-state-on' : 'env-state-off'}>
                  {isOn ? 'Enabled' : 'Disabled'}
                </span>
                <span className="muted"> · default value</span>
              </div>
              <EnvStrategies
                projectId={projectId}
                flagKey={flagKey}
                env={env}
                contextFields={contextFields}
              />
            </div>
          )
        })}
      </div>

      <Modal open={confirmState !== null} onClose={handleCancel}>
        <Modal.Header>{confirmState?.checked ? 'Enable' : 'Disable'} in Production?</Modal.Header>
        <Modal.Body>
          <p>
            {confirmState?.checked ? 'Enable' : 'Disable'} <strong>{flag.name}</strong> in{' '}
            <strong>{confirmState?.env}</strong>? This will affect production traffic.
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
  const { activeProject } = useProject()
  const toast = useToast()

  const [flag, setFlag] = useState<Flag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('environments')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSdkModal, setShowSdkModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const projectId = activeProject?.id

  /**
   * Flag keys are project-scoped, so this URL stops making sense when the
   * user switches projects. Go back to the flags list instead of showing a
   * "flag not found" error for the new project.
   */
  const initialProjectId = useRef(projectId)
  useEffect(() => {
    if (!initialProjectId.current) initialProjectId.current = projectId
    if (projectId && initialProjectId.current && projectId !== initialProjectId.current) {
      navigate('/flags', { replace: true })
    }
  }, [projectId, navigate])

  const fetchFlag = useCallback(
    async (isInitial = false) => {
      if (!projectId || !flagKey) return
      if (isInitial) {
        setLoading(true)
      }
      setError(null)
      try {
        const res = await flagsApi.get(projectId, flagKey)
        setFlag(res.data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load flag')
      } finally {
        if (isInitial) {
          setLoading(false)
        }
      }
    },
    [projectId, flagKey],
  )

  useEffect(() => {
    void fetchFlag(true)
  }, [fetchFlag])

  if (!activeProject) {
    return <div className="flag-detail-no-project">No project selected</div>
  }

  if (loading) {
    return <div className="flag-detail-loading">Loading...</div>
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load flag"
        message={error}
        onRetry={() => void fetchFlag(true)}
      />
    )
  }

  if (!flag) return null

  const envKeys = Object.keys(flag.state ?? {})

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
      <div className="page-header detail-page-header">
        <div className="page-header-text">
          <nav className="detail-breadcrumb">
            <button className="breadcrumb-link" onClick={() => navigate('/flags')}>
              Flags
            </button>
            <Icon name="chevronRight" size={12} />
            <span>{flag.name}</span>
          </nav>
          <h1 className="detail-title">{flag.name}</h1>
        </div>
        <div className="page-header-actions detail-actions">
          <Button variant="ghost" size="sm" leftIcon="code" onClick={() => setShowSdkModal(true)}>
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

      <div className="detail-header">
        <div className="detail-header-main">
          <span className="detail-flag-key">
            <Icon name="flag" size={12} />
            <span className="mono">{flag.key}</span>
            <CopyButton
              value={flag.key}
              iconOnly
              tip="Copy key"
              iconSize={11}
              className="detail-key-copy"
            />
          </span>
          {flag.description && <p className="detail-desc">{flag.description}</p>}
          <div className="meta-row">
            <span className="meta-item">
              <Icon name="user" size={12} />
              Owner <b className="mono">{flag.author || 'System'}</b>
            </span>
            <span className="meta-item">
              <Icon name="history" size={12} />
              Created <b>{new Date(flag.created).toLocaleDateString()}</b>
            </span>
          </div>
        </div>
        <div className="detail-header-aside">
          <span className="muted mono detail-updated">
            updated {new Date(flag.updated).toLocaleDateString()}
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
          Environments
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

      <SdkSnippetModal open={showSdkModal} flag={flag} onClose={() => setShowSdkModal(false)} />
    </div>
  )
}
