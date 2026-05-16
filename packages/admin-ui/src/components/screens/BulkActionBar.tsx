import { useState } from 'react'
import { Button } from '../primitives/Button'
import { Modal } from '../primitives/Modal'
import { flagsApi } from '../../lib/api'

interface BulkActionBarProps {
  selectedKeys: string[]
  projectId: string
  activeEnv: string
  onDone: () => void
}

export function BulkActionBar({ selectedKeys, projectId, activeEnv, onDone }: BulkActionBarProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (selectedKeys.length === 0) return null

  async function handleEnableAll() {
    setLoading(true)
    try {
      await Promise.all(selectedKeys.map((key) => flagsApi.toggle(projectId, key, activeEnv, true)))
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
      <Button variant="ghost" size="sm" onClick={() => { void handleEnableAll() }} disabled={loading}>
        Enable All
      </Button>
      <Button variant="ghost" size="sm" onClick={() => { void handleDisableAll() }} disabled={loading}>
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
          <Button variant="danger" size="sm" onClick={() => { void handleConfirmDelete() }} disabled={loading}>
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
