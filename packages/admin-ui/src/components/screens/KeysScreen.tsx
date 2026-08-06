import { useState, useEffect } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useApiKeys } from '../../hooks/useApiKeys'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { usePermissions } from '../../hooks/usePermissions'
import { keysApi } from '../../lib/api'
import type { ApiKey, ApiKeyType, Env } from '../../lib/types'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'
import { Denied } from '../primitives/Denied'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'
import { TextField } from '../primitives/TextField'
import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'
import { CopyButton } from '../primitives/CopyButton'
import { FormError } from '../primitives/FormError'
import { ErrorState } from '../primitives/ErrorState'
import { Pagination } from '../primitives/Pagination'

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25

/** Absolute date for a key's expiry -- a future/past distinction matters more than "in 3 months". */
function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never'
  const date = new Date(expiresAt)
  const formatted = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return date.getTime() < Date.now() ? `Expired ${formatted}` : formatted
}

export function KeysScreen() {
  const { activeProject } = useProject()

  if (!activeProject) {
    return <div className="keys-empty-project">No project selected</div>
  }

  return <KeysScreenInner projectId={activeProject.id} projectSlug={activeProject.slug} />
}

function KeysScreenInner({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const { environments } = useProject()
  const toast = useToast()
  const { canProjectAdmin } = usePermissions()
  const [showNew, setShowNew] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [envFilter, setEnvFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  /** Typing must not fire a request per keystroke. */
  const debouncedSearch = useDebouncedValue(search, 300)

  const { keys, total, loading, error, refetch } = useApiKeys({
    projectId,
    search: debouncedSearch,
    type: typeFilter === 'all' ? undefined : (typeFilter as ApiKeyType),
    environmentId: envFilter === 'all' ? undefined : envFilter,
    limit,
    offset,
  })

  const anyFilters = search.trim() !== '' || typeFilter !== 'all' || envFilter !== 'all'

  /** Filter changes re-number the pages, so return to the first one. */
  useEffect(() => {
    setOffset((current) => (current === 0 ? current : 0))
  }, [debouncedSearch, typeFilter, envFilter, projectId])

  const envName = (id: string | null) =>
    id ? (environments.find((e) => e.id === id)?.name ?? id) : null

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await keysApi.delete(projectId, revokeTarget.id)
      toast.push({ title: 'Key revoked', variant: 'success' })
      setRevokeTarget(null)
      refetch()
    } catch (err: unknown) {
      toast.push({
        title: err instanceof Error ? err.message : 'Failed to revoke key',
        variant: 'error',
      })
    } finally {
      setRevoking(false)
    }
  }

  if (loading) {
    return <div className="keys-loading">Loading...</div>
  }

  if (error) {
    return <ErrorState title="Failed to load API keys" message={error} onRetry={refetch} />
  }

  return (
    <div className="keys-screen">
      <div className="page-header">
        <div className="page-header-text">
          <h1>API keys</h1>
          <p className="page-header-sub">
            Two tiers: project admin (manage flags) and client (one environment, evaluations only).
            The root key is managed from the CLI.
          </p>
        </div>
        <div className="page-header-actions">
          <Denied when={!canProjectAdmin} reason="Only owners and admins can issue keys">
            <Button
              variant="primary"
              leftIcon="plus"
              disabled={!canProjectAdmin}
              onClick={() => setShowNew(true)}
            >
              Issue key
            </Button>
          </Denied>
        </div>
      </div>

      <div className="keys-toolbar">
        <div className="search-input">
          <Icon name="search" size={14} className="search-ico" />
          <input
            className="filter-search"
            placeholder="Search by label or prefix…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="select-sm"
          aria-label="Scope filter"
          placeholder=""
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All scopes' },
            { value: 'admin', label: 'admin' },
            { value: 'client', label: 'client' },
          ]}
        />
        <Select
          className="select-sm"
          aria-label="Environment filter"
          placeholder=""
          value={envFilter}
          onChange={setEnvFilter}
          options={[
            { value: 'all', label: 'All environments' },
            ...environments.map((e) => ({ value: e.id, label: e.name })),
          ]}
        />
      </div>

      {total === 0 && !anyFilters ? (
        <div className="keys-empty">No API keys yet. Issue one to start calling the API.</div>
      ) : total === 0 ? (
        <div className="keys-empty">No keys match your filters.</div>
      ) : (
        <div className="keys-card">
          <table className="keys-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Scope</th>
                <th>Prefix</th>
                <th>Last used</th>
                <th>Created</th>
                <th>Expires</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <KeyRow
                  key={k.id}
                  apiKey={k}
                  envName={envName(k.environmentId)}
                  onRevoke={() => setRevokeTarget(k)}
                />
              ))}
            </tbody>
          </table>
          <div className="keys-table-foot">
            <Pagination
              total={total}
              limit={limit}
              offset={offset}
              onOffsetChange={setOffset}
              onLimitChange={(next) => {
                /** Page numbers change meaning with the size, so start over. */
                setLimit(next)
                setOffset(0)
              }}
              noun="key"
            />
          </div>
        </div>
      )}

      <div className="keys-security-note">
        <Icon name="shield" size={18} />
        <div>
          <strong>Keys are shown once.</strong> Flagraft only stores a hash, so the plaintext can't
          be recovered. Rotate immediately if a key leaks revoke the old one and issue a new one.
        </div>
      </div>

      <IssueKeyModal
        open={showNew}
        projectId={projectId}
        environments={environments}
        onClose={() => setShowNew(false)}
        onIssued={(plaintext) => {
          setShowNew(false)
          setRevealKey(plaintext)
          refetch()
        }}
      />

      <RevealKeyModal
        plaintext={revealKey}
        projectSlug={projectSlug}
        onClose={() => setRevealKey(null)}
      />

      <Modal open={revokeTarget !== null} onClose={() => setRevokeTarget(null)}>
        <Modal.Header>Revoke API key</Modal.Header>
        <Modal.Body>
          <p>
            Revoke the key starting <strong className="mono">{revokeTarget?.prefix}</strong>? Any
            caller using it will immediately get 401s. This cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setRevokeTarget(null)} disabled={revoking}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleRevoke()} disabled={revoking}>
            {revoking ? 'Revoking...' : 'Revoke key'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

function KeyRow({
  apiKey,
  envName,
  onRevoke,
}: {
  apiKey: ApiKey
  envName: string | null
  onRevoke: () => void
}) {
  const created = useRelativeDate(apiKey.createdAt)
  const lastUsed = useRelativeDate(apiKey.lastUsedAt ?? undefined)
  const { canProjectAdmin } = usePermissions()

  return (
    <tr>
      <td>
        <div className="keys-label">{apiKey.description || <span className="muted">—</span>}</div>
        {envName && <div className="keys-label-sub mono">{envName}</div>}
      </td>
      <td>
        {apiKey.type === 'admin' ? (
          <Badge variant="primary" dot>
            admin
          </Badge>
        ) : (
          <Badge variant="default" dot>
            client
          </Badge>
        )}
      </td>
      <td>
        <span className="mono keys-prefix">
          {apiKey.prefix}
          <span className="muted">…••••••••</span>
        </span>
      </td>
      <td className="keys-date">{apiKey.lastUsedAt ? lastUsed : 'Never'}</td>
      <td className="keys-date muted">{created}</td>
      <td className="keys-date">{formatExpiry(apiKey.expiresAt)}</td>
      <td>
        <div className="keys-actions">
          <CopyButton value={apiKey.prefix} iconOnly tip="Copy prefix" />
          <Tip tip={canProjectAdmin ? 'Revoke' : 'Only owners and admins can revoke keys'}>
            <button
              className="icon-btn"
              aria-label="Revoke key"
              disabled={!canProjectAdmin}
              onClick={onRevoke}
            >
              <Icon name="trash" size={14} />
            </button>
          </Tip>
        </div>
      </td>
    </tr>
  )
}

interface IssueKeyModalProps {
  open: boolean
  projectId: string
  environments: Env[]
  onClose: () => void
  onIssued: (plaintext: string) => void
}

function IssueKeyModal({ open, projectId, environments, onClose, onIssued }: IssueKeyModalProps) {
  const toast = useToast()
  const [type, setType] = useState<ApiKeyType>('admin')
  const [description, setDescription] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType('admin')
      setDescription('')
      setEnvironmentId(environments[0]?.id ?? '')
      setSaving(false)
      setSubmitError(null)
    }
  }, [open, environments])

  const needsEnv = type === 'client'
  const disabled = saving || (needsEnv && !environmentId)

  async function handleSubmit() {
    if (disabled) return
    setSaving(true)
    setSubmitError(null)
    try {
      const created = await keysApi.create(projectId, {
        type,
        description: description.trim() || undefined,
        environmentId: needsEnv ? environmentId : undefined,
      })
      toast.push({ title: 'Key issued', variant: 'success' })
      onIssued(created.data.key)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to issue key'
      setSubmitError(message)
      toast.push({ title: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header subtitle="The plaintext key is shown only once after creation.">
        Issue API key
      </Modal.Header>
      <Modal.Body>
        <div className="keys-form">
          <FormError message={submitError} />
          <TextField
            label="Label"
            value={description}
            onChange={setDescription}
            placeholder="e.g. CI / e2e tests"
            hint="A human-readable name to recognise this key later."
          />
          <div className="keys-form-field">
            <span className="keys-form-label">Scope</span>
            <div className="keys-scope-seg" role="group" aria-label="Key scope">
              <Button
                variant={type === 'admin' ? 'primary' : 'default'}
                size="sm"
                onClick={() => setType('admin')}
              >
                admin
              </Button>
              <Button
                variant={type === 'client' ? 'primary' : 'default'}
                size="sm"
                onClick={() => setType('client')}
              >
                client
              </Button>
            </div>
            <span className="keys-form-hint muted">
              {type === 'admin'
                ? 'Admin keys can read and write flags across all environments.'
                : 'Client keys only evaluate flags in a single environment.'}
            </span>
          </div>
          {needsEnv && (
            <Select
              label="Environment"
              value={environmentId}
              onChange={setEnvironmentId}
              options={environments.map((e) => ({ value: e.id, label: e.name }))}
              error={environments.length === 0 ? 'Create an environment first.' : undefined}
            />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <span className="spacer" />
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={disabled}>
          {saving ? 'Generating...' : 'Generate key'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function RevealKeyModal({
  plaintext,
  projectSlug,
  onClose,
}: {
  plaintext: string | null
  projectSlug: string
  onClose: () => void
}) {
  const curl = `curl https://api.flagraft.io/v1/admin/projects/${projectSlug}/flags \\
  -H "Authorization: ${plaintext ?? ''}"`

  return (
    <Modal open={plaintext !== null} onClose={onClose}>
      <Modal.Header subtitle="You won't be able to see it again. Store it somewhere safe now.">
        Save this key now
      </Modal.Header>
      <Modal.Body>
        <div className="keys-reveal">
          <div className="keys-reveal-code">
            <span className="mono">{plaintext}</span>
            <CopyButton value={plaintext ?? ''} label="Copy" className="keys-reveal-copy" />
          </div>
          <div className="keys-reveal-usage">
            <div className="keys-reveal-usage-head">
              <Icon name="info" size={13} /> Use it like this
            </div>
            <pre className="keys-reveal-curl mono">{curl}</pre>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <span className="muted keys-reveal-foot">Stored as a SHA-256 hash, not recoverable.</span>
        <span className="spacer" />
        <Button variant="primary" onClick={onClose}>
          I&apos;ve saved it
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
