import { useEffect, useState } from 'react'
import { useOverrides } from '../../hooks/useOverrides'
import { useContextFields } from '../../hooks/useContextFields'
import { useToast } from '../../hooks/useToast'
import { OverrideRow } from './OverrideRow'
import { OverrideForm } from './OverrideForm'
import { OverridesEmptyState } from './OverridesEmptyState'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'
import type { Override } from '../../lib/types'

interface OverrideEnvOption {
  slug: string
  name: string
  defaultOn: boolean
  count: number
}

interface ContextOverridesSectionProps {
  projectId: string
  flagKey: string
  env: string
  /** When provided, renders the per-environment selector tabs. */
  environments?: OverrideEnvOption[]
}

/** Maps an environment slug to its dot-tone class (teal/amber/red/slate). */
function envTone(slug: string): string {
  if (slug === 'production' || slug.endsWith('production')) return 'red'
  if (slug === 'staging' || slug.endsWith('staging')) return 'amber'
  if (slug === 'development' || slug.endsWith('development')) return 'teal'
  return 'slate'
}

export function ContextOverridesSection({
  projectId,
  flagKey,
  env,
  environments,
}: ContextOverridesSectionProps) {
  /** The environment whose overrides are currently shown; switched via the tabs. */
  const [selectedEnv, setSelectedEnv] = useState(env)

  useEffect(() => {
    setSelectedEnv(env)
  }, [env])

  const { overrides, loading, error, createOverride, updateOverride, deleteOverride } =
    useOverrides({ projectId, flagKey, env: selectedEnv })
  const { fields } = useContextFields(projectId)
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [editingOverride, setEditingOverride] = useState<Override | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Override | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  function handleAddClick() {
    setEditingOverride(null)
    setShowForm(true)
  }

  function handleEditClick(override: Override) {
    setEditingOverride(override)
    setShowForm(true)
  }

  function handleDeleteClick(id: string) {
    const target = overrides.find((o) => o.id === id) ?? null
    setDeleteTarget(target)
  }

  async function handleSave(data: Omit<Override, 'id' | 'flag' | 'created'>) {
    setMutationError(null)
    try {
      if (editingOverride) {
        await updateOverride(editingOverride.id, data)
      } else {
        await createOverride(data)
      }
      setShowForm(false)
      setEditingOverride(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setMutationError(message)
      toast.push({ title: message, variant: 'error' })
    }
  }

  function handleCancel() {
    setShowForm(false)
    setEditingOverride(null)
  }

  async function handleConfirmDelete() {
    if (deleteTarget) {
      setMutationError(null)
      try {
        await deleteOverride(deleteTarget.id)
        setDeleteTarget(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed'
        setMutationError(message)
        toast.push({ title: message, variant: 'error' })
      }
    }
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
  }

  return (
    <div className="overrides-section">
      <div className="overrides-header">
        <div className="overrides-header-text">
          <h2>Context overrides</h2>
          <p className="overrides-subtitle">
            When a request matches a rule, the rule&apos;s result wins over the environment default.
            Rules are evaluated top-to-bottom; first match wins.
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon="plus" onClick={handleAddClick}>
          Add override
        </Button>
      </div>

      {environments && environments.length > 0 && (
        <div className="ctx-ovr-envtabs" role="tablist" aria-label="Override environment">
          {environments.map((e) => {
            const count = e.slug === selectedEnv ? overrides.length : e.count
            return (
              <button
                key={e.slug}
                type="button"
                role="tab"
                aria-pressed={selectedEnv === e.slug}
                data-env={e.slug}
                className="ctx-ovr-envtab"
                onClick={() => {
                  setSelectedEnv(e.slug)
                  setEditingOverride(null)
                }}
              >
                <span className={`env-dot ${envTone(e.slug)}`} />
                <span className="env-name">{e.name}</span>
                <span className="env-state mono">default {e.defaultOn ? 'on' : 'off'}</span>
                <span className="env-count num">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {mutationError && (
        <div className="overrides-mutation-error" role="alert">
          {mutationError}
        </div>
      )}

      {loading ? (
        <div className="overrides-loading">Loading...</div>
      ) : error ? (
        <div className="overrides-error">{error}</div>
      ) : overrides.length === 0 && !showForm ? (
        <OverridesEmptyState
          onAdd={handleAddClick}
          envName={environments?.find((e) => e.slug === selectedEnv)?.name ?? selectedEnv}
        />
      ) : (
        <div className="ctx-ovr-stack">
          {overrides.map((override, i) =>
            showForm && editingOverride?.id === override.id ? (
              <OverrideForm
                key={override.id}
                projectId={projectId}
                flagKey={flagKey}
                env={selectedEnv}
                contextFields={fields}
                existingOverrides={overrides}
                editingOverride={editingOverride}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            ) : (
              <OverrideRow
                key={override.id}
                index={i}
                override={override}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            ),
          )}
          {showForm && !editingOverride && (
            <OverrideForm
              key="new"
              projectId={projectId}
              flagKey={flagKey}
              env={selectedEnv}
              contextFields={fields}
              existingOverrides={overrides}
              editingOverride={null}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
          {!showForm && overrides.length > 0 && (
            <button type="button" className="ctx-ovr-addrow" onClick={handleAddClick}>
              <Icon name="plus" size={13} />
              <span>Add another override</span>
            </button>
          )}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={handleCancelDelete}>
        <Modal.Header>Delete Override</Modal.Header>
        <Modal.Body>
          <p>Delete override for &apos;{deleteTarget?.key}&apos;?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={handleCancelDelete}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void handleConfirmDelete()
            }}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
