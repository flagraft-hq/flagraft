import { useState } from 'react'

import { contextFieldsApi, ApiError } from '../../lib/api'
import { useContextFields } from '../../hooks/useContextFields'
import type { ContextField, FieldType } from '../../lib/types'
import { Badge } from '../primitives/Badge'
import { Button } from '../primitives/Button'
import { ErrorState } from '../primitives/ErrorState'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
import { Modal } from '../primitives/Modal'
import { Tip } from '../primitives/Tip'
import { ContextFieldDialog } from './ContextFieldDialog'

/** Badge tone per field type — enum reads teal, version amber, the rest neutral. */
const TYPE_VARIANT: Record<FieldType, 'default' | 'success' | 'warning'> = {
  string: 'default',
  enum: 'success',
  boolean: 'default',
  number: 'default',
  version: 'warning',
  date: 'default',
}

const SOURCE_LABEL: Record<string, string> = {
  sdk: 'SDK',
  server: 'Server',
  computed: 'Computed',
}

export function ContextFieldsSection({ projectId }: { projectId: string }) {
  const { fields, loading, error, refetch } = useContextFields(projectId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContextField | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContextField | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(field: ContextField) {
    setEditing(field)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await contextFieldsApi.delete(projectId, deleteTarget.id)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete context field')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Context fields</h2>
      <p className="ctx-section-sub">
        The attributes targeting rules match on. The SDK sends these alongside each evaluation.
        Only fields registered here can be referenced in rules — unknown keys are ignored, so a
        typo like <span className="mono">userid</span> can’t silently break a rollout.
      </p>

      {loading ? (
        <div className="ctx-inline-state">Loading context fields…</div>
      ) : error ? (
        <ErrorState title="Failed to load context fields" message={error} onRetry={refetch} />
      ) : (
        <>
          {fields.length === 0 ? (
            <div className="ctx-inline-state ctx-empty">
              No context fields yet. Add one to document what your SDK sends.
            </div>
          ) : (
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Example</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="ctx-key-row">
                        <span className="mono ctx-key">{f.key}</span>
                        {f.required && <Badge variant="warning">required</Badge>}
                      </div>
                      {f.description && <div className="ctx-key-desc">{f.description}</div>}
                    </td>
                    <td>
                      <Badge variant={TYPE_VARIANT[f.type]} mono>
                        {f.type}
                      </Badge>
                      {f.enumValues && f.enumValues.length > 0 && (
                        <div className="ctx-enum-chips">
                          {f.enumValues.slice(0, 3).map((v) => (
                            <span key={v} className="ctx-enum mono">
                              {v}
                            </span>
                          ))}
                          {f.enumValues.length > 3 && (
                            <span className="muted ctx-enum-more">+{f.enumValues.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="ctx-source" data-source={f.source}>
                        <span className="dot" />
                        {SOURCE_LABEL[f.source] ?? f.source}
                      </span>
                    </td>
                    <td>
                      <span className="mono ctx-example">{f.example ?? '—'}</span>
                    </td>
                    <td>
                      <div className="ctx-row-actions">
                        <Tip tip="Edit field">
                          <button
                            className="icon-btn"
                            aria-label={`Edit ${f.key}`}
                            onClick={() => openEdit(f)}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                        </Tip>
                        <Tip tip="Delete field">
                          <button
                            className="icon-btn"
                            aria-label={`Delete ${f.key}`}
                            onClick={() => setDeleteTarget(f)}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </Tip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="ctx-section-foot">
            <Button variant="primary" leftIcon="plus" onClick={openAdd}>
              Add field
            </Button>
          </div>
        </>
      )}

      <ContextFieldDialog
        open={dialogOpen}
        projectId={projectId}
        field={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={refetch}
      />

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <Modal.Header>Delete context field</Modal.Header>
        <Modal.Body>
          <FormError message={deleteError} />
          <p>
            Delete <strong className="mono">{deleteTarget?.key}</strong>? Any targeting rules that
            reference it will need updating. This cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
