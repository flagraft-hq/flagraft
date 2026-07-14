import { useState } from 'react'
import { Button } from '../primitives/Button'
import { Modal } from '../primitives/Modal'
import { flagsApi } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

interface BulkActionBarProps {
  selectedKeys: string[]
  projectId: string
  activeEnv: string
  onDone: () => void
  onCancel?: () => void
}

export function BulkActionBar({
  selectedKeys,
  projectId,
  activeEnv,
  onDone,
  onCancel,
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const toast = useToast()

  if (selectedKeys.length === 0) return null

  async function handleEnableAll() {
    setLoading(true)
    try {
      await Promise.all(selectedKeys.map((key) => flagsApi.toggle(projectId, key, activeEnv, true)))
      toast.push({ title: 'Flags enabled', variant: 'success' })
      onDone()
    } catch (err) {
      toast.push({
        title: 'Failed to enable flags',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableAll() {
    setLoading(true)
    try {
      await Promise.all(
        selectedKeys.map((key) => flagsApi.toggle(projectId, key, activeEnv, false)),
      )
      toast.push({ title: 'Flags disabled', variant: 'success' })
      onDone()
    } catch (err) {
      toast.push({
        title: 'Failed to disable flags',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmDelete() {
    setLoading(true)
    try {
      await Promise.all(selectedKeys.map((key) => flagsApi.delete(projectId, key)))
      toast.push({
        title: selectedKeys.length === 1 ? 'Flag deleted' : `${selectedKeys.length} flags deleted`,
        variant: 'success',
      })
      setShowDeleteConfirm(false)
      onDone()
    } catch (err) {
      toast.push({
        title: 'Failed to delete flags',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const flagWord = selectedKeys.length === 1 ? 'flag' : 'flags'

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{selectedKeys.length} selected</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void handleEnableAll()
        }}
        disabled={loading}
      >
        Enable All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void handleDisableAll()
        }}
        disabled={loading}
      >
        Disable All
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setShowDeleteConfirm(true)}
        disabled={loading}
      >
        Delete
      </Button>

      {onCancel && (
        <button
          className="bulk-close"
          onClick={onCancel}
          aria-label="Clear selection"
          disabled={loading}
        >
          ×
        </button>
      )}

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        titleId="bulk-delete-title"
      >
        <Modal.Header
          id="bulk-delete-title"
          subtitle={`The selected ${flagWord} will be permanently removed from all environments. This cannot be undone.`}
        >
          Delete {selectedKeys.length === 1 ? 'this flag' : `${selectedKeys.length} flags`}?
        </Modal.Header>
        <Modal.Footer>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void handleConfirmDelete()
            }}
            disabled={loading}
          >
            {loading ? 'Deleting…' : `Delete ${flagWord}`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
