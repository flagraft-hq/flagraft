import { useState, useEffect } from 'react'
import {
  Button,
  Chip,
  Description,
  Input,
  Label,
  SearchField,
  Table,
  TextField,
  Tooltip,
} from '@heroui/react'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useApiKeys } from '../../hooks/useApiKeys'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { usePermissions } from '../../hooks/usePermissions'
import { keysApi, apiBaseUrl } from '../../lib/api'
import { formatDate } from '../../lib/dates'
import type { ApiKey, ApiKeyType, Env } from '../../lib/types'
import { Denied } from '../primitives/Denied'
import { Dialog } from '../primitives/Dialog'
import { Icon } from '../primitives/Icon'
import { CopyButton } from '../primitives/CopyButton'
import { FormError } from '../primitives/FormError'
import { ErrorState } from '../primitives/ErrorState'
import { Pagination } from '../primitives/Pagination'
import { FilterSelect } from '../primitives/FilterSelect'

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25

/**
 * Absolute date for a key's expiry -- a future/past distinction matters more
 * than "in 3 months". Already-expired keys are called out in red, so the
 * caller gets the flag rather than having to re-parse the string.
 */
function formatExpiry(expiresAt: string | null): { label: string; expired: boolean } {
  if (!expiresAt) return { label: 'Never', expired: false }
  const formatted = formatDate(expiresAt)
  const expired = new Date(expiresAt).getTime() < Date.now()
  return { label: expired ? `Expired ${formatted}` : formatted, expired }
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
    <div className="keys-screen dc">
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
              isDisabled={!canProjectAdmin}
              onClick={() => setShowNew(true)}
            >
              <Icon name="plus" size={14} />
              Issue key
            </Button>
          </Denied>
        </div>
      </div>

      <div className="dc-toolbar">
        <SearchField aria-label="Search keys" value={search} onChange={setSearch}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search by label or prefix…" />
          </SearchField.Group>
        </SearchField>
        <FilterSelect
          label="Scope filter"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All scopes' },
            { value: 'admin', label: 'admin' },
            { value: 'client', label: 'client' },
          ]}
        />
        <FilterSelect
          label="Environment filter"
          value={envFilter}
          onChange={setEnvFilter}
          options={[
            { value: 'all', label: 'All environments' },
            ...environments.map((e) => ({ value: e.id, label: e.name })),
          ]}
        />
      </div>

      {total === 0 && !anyFilters ? (
        <div className="dc-empty">No API keys yet. Issue one to start calling the API.</div>
      ) : total === 0 ? (
        <div className="dc-empty">No keys match your filters.</div>
      ) : (
        <div className="keys-card dc-card">
          <Table>
            <Table.Content aria-label="API keys">
              <Table.Header>
                <Table.Column isRowHeader id="label">
                  Label
                </Table.Column>
                <Table.Column id="scope">Scope</Table.Column>
                <Table.Column id="prefix">Prefix</Table.Column>
                <Table.Column id="lastUsed">Last used</Table.Column>
                <Table.Column id="created">Created</Table.Column>
                <Table.Column id="expires">Expires</Table.Column>
                <Table.Column id="actions" aria-label="Actions">
                  {''}
                </Table.Column>
              </Table.Header>
              <Table.Body items={keys}>
                {(k: ApiKey) => (
                  <KeyRow
                    apiKey={k}
                    envName={envName(k.environmentId)}
                    onRevoke={() => setRevokeTarget(k)}
                  />
                )}
              </Table.Body>
            </Table.Content>
          </Table>
          <div className="dc-table-foot">
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
        <span className="keys-security-icon">
          <Icon name="shield" size={14} />
        </span>
        <div>
          <strong>Keys are shown once.</strong> Flagraft only stores a hash, so the plaintext can't
          be recovered. If a key leaks, revoke the old one and issue a new one immediately.
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

      <Dialog
        className="keys-dialog"
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke API key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)} isDisabled={revoking}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleRevoke()} isDisabled={revoking}>
              {revoking ? 'Revoking...' : 'Revoke key'}
            </Button>
          </>
        }
      >
        <p>
          Revoke the key starting <strong className="mono">{revokeTarget?.prefix}</strong>? Any
          caller using it will immediately get 401s. This cannot be undone.
        </p>
      </Dialog>
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
  const expiry = formatExpiry(apiKey.expiresAt)

  return (
    <Table.Row id={apiKey.id}>
      <Table.Cell>
        <div className="keys-label">{apiKey.description || <span className="muted">—</span>}</div>
        {envName && <div className="keys-label-sub mono">{envName}</div>}
      </Table.Cell>
      <Table.Cell>
        <Chip className={`keys-scope keys-scope--${apiKey.type}`} size="sm">
          <span className="keys-scope-dot" aria-hidden="true" />
          {apiKey.type}
        </Chip>
      </Table.Cell>
      <Table.Cell>
        <span className="mono keys-prefix">
          {apiKey.prefix}
          <span className="muted">…••••••••</span>
        </span>
      </Table.Cell>
      <Table.Cell className="keys-date">{apiKey.lastUsedAt ? lastUsed : 'Never'}</Table.Cell>
      <Table.Cell className="keys-date keys-date--soft">{created}</Table.Cell>
      <Table.Cell className={`keys-date${expiry.expired ? ' keys-date--expired' : ''}`}>
        {expiry.label}
      </Table.Cell>
      <Table.Cell>
        <div className="keys-actions">
          <CopyButton value={apiKey.prefix} iconOnly tip="Copy prefix" />
          <Tooltip>
            <Button
              className="icon-btn"
              variant="ghost"
              isIconOnly
              aria-label="Revoke key"
              isDisabled={!canProjectAdmin}
              onClick={onRevoke}
            >
              <Icon name="trash" size={14} />
            </Button>
            <Tooltip.Content>
              {canProjectAdmin ? 'Revoke' : 'Only owners and admins can revoke keys'}
            </Tooltip.Content>
          </Tooltip>
        </div>
      </Table.Cell>
    </Table.Row>
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
  const disabled = saving || !description.trim() || (needsEnv && !environmentId)

  async function handleSubmit() {
    if (disabled) return
    setSaving(true)
    setSubmitError(null)
    try {
      const created = await keysApi.create(projectId, {
        type,
        description: description.trim(),
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
    <Dialog
      className="keys-dialog"
      size="lg"
      open={open}
      onClose={onClose}
      title="Issue API key"
      subtitle="The plaintext key is shown only once after creation."
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
            Generate key
          </Button>
        </>
      }
    >
      <div className="dc-form">
        <FormError message={submitError} />
        <TextField value={description} onChange={setDescription}>
          <Label>Label</Label>
          <Input placeholder="e.g. CI / e2e tests" />
          <Description>A human-readable name to recognise this key later.</Description>
        </TextField>
        <div className="dc-form-field">
          <span className="dc-form-label">Scope</span>
          <div className="keys-scope-seg" role="group" aria-label="Key scope">
            <Button
              variant={type === 'admin' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setType('admin')}
            >
              admin
            </Button>
            <Button
              variant={type === 'client' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setType('client')}
            >
              client
            </Button>
          </div>
          <span className="dc-form-hint muted">
            {type === 'admin'
              ? 'Admin keys can read and write flags across all environments.'
              : 'Client keys only evaluate flags in a single environment.'}
          </span>
        </div>
        <div className="dc-form-field" style={!needsEnv ? { opacity: 0.6 } : undefined}>
          <span className="dc-form-label" id="issue-env-label">
            Environment
          </span>
          <FilterSelect
            label="Environment"
            value={environmentId}
            onChange={setEnvironmentId}
            options={
              environments.length
                ? environments.map((e) => ({ value: e.id, label: e.name }))
                : [{ value: '', label: 'No environments' }]
            }
            isDisabled={!needsEnv || environments.length === 0}
          />
          {needsEnv && environments.length === 0 && (
            <FormError message="Create an environment first." />
          )}
        </div>
      </div>
    </Dialog>
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
  const curl = `curl ${apiBaseUrl}/admin/projects/${projectSlug}/flags \\
  -H "Authorization: ${plaintext ?? ''}"`

  return (
    <Dialog
      className="keys-dialog"
      open={plaintext !== null}
      onClose={onClose}
      title="Save this key now"
      subtitle="You won't be able to see it again. Store it somewhere safe now."
      footer={
        <>
          <span className="muted keys-reveal-foot">Stored as a SHA-256 hash, not recoverable.</span>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            I&apos;ve saved it
          </Button>
        </>
      }
    >
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
    </Dialog>
  )
}
