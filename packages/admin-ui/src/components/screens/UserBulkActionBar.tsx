import { useState } from 'react'
import { usersApi } from '../../lib/api'
import type { WorkspaceUser } from '../../lib/api'
import { INVITABLE_ROLES, USER_ROLES, type InvitableRole } from '../../lib/roles'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useResendInvite } from '../../hooks/useResendInvite'
import { InviteLinksModal } from './InviteLinksModal'
import { BulkBar, BulkSep } from '../primitives/BulkBar'
import { Button } from '../primitives/Button'
import { Modal } from '../primitives/Modal'
import { Select } from '../primitives/Select'

interface UserBulkActionBarProps {
  selectedUsers: WorkspaceUser[]
  /** Called after a successful action so the parent can refresh and clear. */
  onDone: () => void | Promise<void>
  /** Clears the selection without doing anything. */
  onCancel: () => void
}

function plural(n: number, word: string) {
  return `${n} ${n === 1 ? word : word + 's'}`
}

/**
 * Bulk actions for the users directory: change role, grant project access,
 * suspend (with confirmation), and reinstate. Owners and service accounts
 * are never role-changed or suspended; ineligible controls are disabled.
 */
export function UserBulkActionBar({ selectedUsers, onDone, onCancel }: UserBulkActionBarProps) {
  const toast = useToast()
  const { projects } = useProject()
  const { resendInvites, fallbackLinks, dismissFallback } = useResendInvite()
  const [busy, setBusy] = useState(false)
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false)

  /** Owners and service accounts are protected from bulk role/status changes. */
  const editable = selectedUsers.filter((u) => u.role !== USER_ROLES.OWNER && !u.isSystem)
  const suspendTargets = editable.filter((u) => u.status !== 'suspended')
  const reinstateTargets = editable.filter((u) => u.status === 'suspended')
  const inviteTargets = selectedUsers.filter((u) => u.status === 'invited')
  const skippedCount = selectedUsers.length - editable.length
  const skippedNote =
    skippedCount > 0 ? ` Owners and service accounts were skipped (${skippedCount}).` : ''

  async function run(
    targets: WorkspaceUser[],
    action: (u: WorkspaceUser) => Promise<unknown>,
    successTitle: string,
    failureTitle: string,
  ) {
    setBusy(true)
    try {
      await Promise.all(targets.map(action))
      toast.push({ title: successTitle, msg: skippedNote || undefined, variant: 'success' })
      setShowSuspendConfirm(false)
      await onDone()
    } catch (err) {
      toast.push({
        title: failureTitle,
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleRole(role: InvitableRole) {
    void run(
      editable,
      (u) => usersApi.patch(u.id, { role }),
      `Role changed to ${role} for ${plural(editable.length, 'user')}`,
      'Failed to change roles',
    )
  }

  function handleAddToProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) return
    void run(
      selectedUsers,
      (u) => usersApi.addToProject(u.id, projectId),
      `Added ${plural(selectedUsers.length, 'user')} to ${proj.name}`,
      'Failed to add to project',
    )
  }

  function handleSuspend() {
    void run(
      suspendTargets,
      (u) => usersApi.patch(u.id, { status: 'suspended' }),
      `Suspended ${plural(suspendTargets.length, 'user')}`,
      'Failed to suspend users',
    )
  }

  function handleReinstate() {
    void run(
      reinstateTargets,
      (u) => usersApi.patch(u.id, { status: 'active' }),
      `Reinstated ${plural(reinstateTargets.length, 'user')}`,
      'Failed to reinstate users',
    )
  }

  async function handleResendInvites() {
    setBusy(true)
    const ok = await resendInvites(inviteTargets)
    if (ok) await onDone()
    setBusy(false)
  }

  return (
    <>
      <BulkBar count={selectedUsers.length} onClear={onCancel} busy={busy}>
        <BulkSep />
        <span className="bulk-section-label">Role</span>
        <Select
          className="select-sm"
          aria-label="Change role"
          placeholder="Change role…"
          value=""
          onChange={(v) => {
            if (v) handleRole(v as InvitableRole)
          }}
          disabled={busy || editable.length === 0}
          title={editable.length === 0 ? 'Owners and service accounts keep their role' : ''}
          options={INVITABLE_ROLES.map((r) => ({ value: r, label: r }))}
        />
        <BulkSep />
        <span className="bulk-section-label">Access</span>
        <Select
          className="select-sm"
          aria-label="Add to project"
          placeholder="Add to project…"
          value=""
          onChange={(v) => {
            if (v) handleAddToProject(v)
          }}
          disabled={busy}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <BulkSep />
        <Button
          size="sm"
          onClick={() => void handleResendInvites()}
          disabled={busy || inviteTargets.length === 0}
          title={inviteTargets.length === 0 ? 'Only invited users can be re-invited' : ''}
        >
          Resend invites
        </Button>
        <Button
          size="sm"
          onClick={handleReinstate}
          disabled={busy || reinstateTargets.length === 0}
        >
          Reinstate
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setShowSuspendConfirm(true)}
          disabled={busy || suspendTargets.length === 0}
        >
          Suspend
        </Button>
      </BulkBar>

      <Modal
        open={showSuspendConfirm}
        onClose={() => setShowSuspendConfirm(false)}
        titleId="bulk-suspend-title"
      >
        <Modal.Header
          id="bulk-suspend-title"
          subtitle={`Suspended users are signed out immediately and can no longer log in. You can reinstate them later.${skippedNote}`}
        >
          Suspend {suspendTargets.length === 1 ? 'this user' : `${suspendTargets.length} users`}?
        </Modal.Header>
        <Modal.Footer>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => setShowSuspendConfirm(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSuspend} disabled={busy}>
            {busy ? 'Suspending…' : `Suspend ${suspendTargets.length === 1 ? 'user' : 'users'}`}
          </Button>
        </Modal.Footer>
      </Modal>

      <InviteLinksModal links={fallbackLinks} onClose={dismissFallback} />
    </>
  )
}
