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
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmDelete() {
    setLoading(true)
    try {
      await Promise.all(selectedKeys.map((key) => flagsApi.delete(projectId, key)))
      setShowDeleteConfirm(false)
      onDone()
    } finally {
      setLoading(false)
    }
  }

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

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <Modal.Header>Delete {selectedKeys.length} flags?</Modal.Header>
        <Modal.Footer>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              void handleConfirmDelete()
            }}
            disabled={loading}
          >
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
