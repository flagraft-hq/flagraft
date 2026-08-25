import { useState } from 'react'
import { Button } from '@heroui/react'
import { BulkBar } from '../primitives/BulkBar'
import { Denied } from '../primitives/Denied'
import { Dialog } from '../primitives/Dialog'
import { flagsApi } from '../../lib/api'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../hooks/useToast'

interface BulkActionBarProps {
  selectedKeys: string[]
  projectId: string
  activeEnv: string
  onDone: () => void
  onCancel?: () => void
}

export function FlagBulkActionBar({
  selectedKeys,
  projectId,
  activeEnv,
  onDone,
  onCancel,
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const toast = useToast()
  const { canWriteEnv, canProjectAdmin } = usePermissions()
  const canToggle = canWriteEnv(activeEnv)

  if (selectedKeys.length === 0) return null

  async function handleToggleAll(enabled: boolean) {
    setLoading(true)
    try {
      await Promise.all(
        selectedKeys.map((key) => flagsApi.toggle(projectId, key, activeEnv, enabled)),
      )
      toast.push({ title: enabled ? 'Flags enabled' : 'Flags disabled', variant: 'success' })
      onDone()
    } catch (err) {
      toast.push({
        title: enabled ? 'Failed to enable flags' : 'Failed to disable flags',
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
    <BulkBar count={selectedKeys.length} onClear={onCancel} busy={loading}>
      <Denied when={!canToggle} reason={`Your role can’t change flags in ${activeEnv}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleToggleAll(true)}
          isDisabled={loading || !canToggle}
        >
          Enable All
        </Button>
      </Denied>
      <Denied when={!canToggle} reason={`Your role can’t change flags in ${activeEnv}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleToggleAll(false)}
          isDisabled={loading || !canToggle}
        >
          Disable All
        </Button>
      </Denied>
      <Denied when={!canProjectAdmin} reason="Only owners and admins can delete flags">
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          isDisabled={loading || !canProjectAdmin}
        >
          Delete
        </Button>
      </Denied>

      <Dialog
        className="flags-dialog"
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete ${selectedKeys.length === 1 ? 'this flag' : `${selectedKeys.length} flags`}?`}
        subtitle={`The selected ${flagWord} will be permanently removed from all environments. This cannot be undone.`}
        footer={
          <>
            <span className="spacer" />
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              isDisabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleConfirmDelete()}
              isDisabled={loading}
            >
              {loading ? 'Deleting…' : `Delete ${flagWord}`}
            </Button>
          </>
        }
      />
    </BulkBar>
  )
}
