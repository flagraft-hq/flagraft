import { useState } from 'react'
import { useOverrides } from '../../hooks/useOverrides'
import { useContextFields } from '../../hooks/useContextFields'
import { useToast } from '../../hooks/useToast'
import { OverrideRow } from './OverrideRow'
import { OverrideForm } from './OverrideForm'
import { OverridesEmptyState } from './OverridesEmptyState'
import { Button } from '../primitives/Button'
import { Modal } from '../primitives/Modal'
import type { Override } from '../../lib/types'

interface ContextOverridesSectionProps {
  projectId: string
  flagKey: string
  env: string
}

export function ContextOverridesSection({ projectId, flagKey, env }: ContextOverridesSectionProps) {
  const { overrides, loading, error, createOverride, updateOverride, deleteOverride } =
    useOverrides({ projectId, flagKey, env })
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
        <h2>Context Overrides</h2>
        <Button variant="ghost" size="sm" leftIcon="plus" onClick={handleAddClick}>
          Add Override
        </Button>
      </div>

      {mutationError && (
        <div className="overrides-mutation-error" role="alert">
          {mutationError}
        </div>
      )}

      {showForm && (
        <div className="overrides-form-container">
          <OverrideForm
            projectId={projectId}
            flagKey={flagKey}
            env={env}
            contextFields={fields}
            existingOverrides={overrides}
            editingOverride={editingOverride}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {loading ? (
        <div className="overrides-loading">Loading...</div>
      ) : error ? (
        <div className="overrides-error">{error}</div>
      ) : overrides.length === 0 ? (
        <OverridesEmptyState onAdd={handleAddClick} />
      ) : (
        <div className="overrides-list">
          {overrides.map((override) => (
            <OverrideRow
              key={override.id}
              override={override}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
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
