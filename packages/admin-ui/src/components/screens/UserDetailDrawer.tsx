import { useState } from 'react'
import { Button, Chip, Drawer, Tooltip } from '@heroui/react'
import type { WorkspaceUser } from '../../lib/api'
import { usersApi } from '../../lib/api'
import { USER_ROLES } from '../../lib/roles'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useResendInvite } from '../../hooks/useResendInvite'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { formatDate } from '../../lib/dates'
import { FilterSelect } from '../primitives/FilterSelect'
import { usePermissions } from '../../hooks/usePermissions'
import { Icon } from '../primitives/Icon'
import { InviteLinksModal } from './InviteLinksModal'
import { ResetPasswordModal } from './ResetPasswordModal'

interface UserDetailDrawerProps {
  user: WorkspaceUser
  onClose: () => void
  onUpdated?: (user: WorkspaceUser) => void
}

/**
 * Right-anchored overlay showing details for one workspace user.
 *
 * The parent mounts this only while a user is selected, so it is always open
 * once rendered; React Aria closes it on Escape or a click outside and hands
 * focus back to whatever opened it.
 */
export function UserDetailDrawer({ user, onClose, onUpdated }: UserDetailDrawerProps) {
  const toast = useToast()
  const { resendInvites, fallbackLinks, dismissFallback } = useResendInvite()
  const { projects } = useProject()
  const [showAddProject, setShowAddProject] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  /**
   * Editors and viewers may read a member's details but change nothing, so
   * the controls are left out rather than shown greyed: everything in the
   * footer and the project list acts, none of it informs.
   */
  const { canProjectAdmin: canManageMembers } = usePermissions()
  const relativeLastLogin = useRelativeDate(user.lastLoginAt ?? undefined)

  async function handleSuspendToggle() {
    setBusy(true)
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended'
    try {
      const res = await usersApi.patch(user.id, { status: nextStatus })
      toast.push({ title: nextStatus === 'suspended' ? 'User suspended' : 'User reinstated' })
      /** The PATCH response has no projects relation; keep the ones we have. */
      onUpdated?.({ ...user, ...res.data, projects: user.projects })
    } catch (err) {
      toast.push({
        title: 'Failed to update user',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddToProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) return
    setBusy(true)
    try {
      await usersApi.addToProject(user.id, projectId)
      toast.push({ title: 'Added to project' })
      setShowAddProject(false)
      if (!user.projects.includes(proj.name)) {
        onUpdated?.({ ...user, projects: [...user.projects, proj.name] })
      }
    } catch (err) {
      toast.push({
        title: 'Failed to add to project',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveFromProject(projectName: string) {
    const proj = projects.find((p) => p.name === projectName)
    if (!proj) return
    setBusy(true)
    try {
      await usersApi.removeFromProject(user.id, proj.id)
      toast.push({ title: 'Removed from project' })
      onUpdated?.({ ...user, projects: user.projects.filter((p) => p !== projectName) })
    } catch (err) {
      toast.push({
        title: 'Failed to remove from project',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer.Root isOpen onOpenChange={(next) => !next && onClose()}>
      <Drawer.Backdrop className="dc-backdrop">
        <Drawer.Content placement="right" className="dc user-drawer">
          <Drawer.Dialog aria-label={'User detail: ' + user.name}>
            <Drawer.Header className="user-drawer-head">
              <button type="button" className="dc-icon-btn" onClick={onClose} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </Drawer.Header>

            <Drawer.Body className="user-drawer-body">
              <div className="user-drawer-hero">
                <span className={'avatar lg color-' + user.tone}>{user.initials}</span>
                <div className="user-drawer-ident">
                  <Drawer.Heading className="user-drawer-name">{user.name}</Drawer.Heading>
                  <div className="user-drawer-email">{user.email}</div>
                  <div className="user-drawer-tags">
                    <Chip className={'users-role users-role--' + user.role} size="sm">
                      {user.role}
                    </Chip>
                    <Chip className={'users-tag users-tag--' + statusTone(user.status)} size="sm">
                      {user.status}
                    </Chip>
                    {user.isSystem ? (
                      <Chip className="users-tag users-tag--slate" size="sm">
                        service
                      </Chip>
                    ) : null}
                  </div>
                </div>
              </div>

              <section className="user-section">
                <h3>Details</h3>
                <DRow label="User ID" value={<span className="mono">{user.id}</span>} />
                <DRow label="Joined" value={formatDate(user.createdAt)} />
                <DRow
                  label="Last login"
                  value={
                    <span className="mono">
                      {user.lastLoginAt == null ? 'never' : relativeLastLogin}
                    </span>
                  }
                />
              </section>

              <section className="user-section">
                <h3>Project access · {user.projects.length}</h3>
                <div className="user-projects">
                  {user.projects.map((p) => (
                    <div key={p} className="user-project">
                      <span className="proj-avatar">{initialsOf(p)}</span>
                      <div className="user-project-text">
                        <div className="user-project-name">{p}</div>
                        <div className="muted mono user-project-role">{user.role}</div>
                      </div>
                      {canManageMembers ? (
                        <Tooltip>
                          <Button
                            className="dc-icon-btn"
                            variant="ghost"
                            isIconOnly
                            onClick={() => void handleRemoveFromProject(p)}
                            isDisabled={busy}
                            aria-label={'Remove from ' + p}
                          >
                            <Icon name="x" size={12} />
                          </Button>
                          <Tooltip.Content>Remove from project</Tooltip.Content>
                        </Tooltip>
                      ) : null}
                    </div>
                  ))}
                  {!canManageMembers ? null : showAddProject ? (
                    <div className="user-add-project-picker">
                      <FilterSelect
                        label="Choose project"
                        placeholder="Choose project..."
                        value=""
                        onChange={(v) => {
                          if (v) void handleAddToProject(v)
                        }}
                        options={projects.map((p) => ({ value: p.id, label: p.name }))}
                      />
                      <Button size="sm" variant="ghost" onClick={() => setShowAddProject(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="user-add-project"
                      onClick={() => setShowAddProject(true)}
                      disabled={busy}
                    >
                      <Icon name="plus" size={12} /> Add to project
                    </button>
                  )}
                </div>
              </section>

              <section className="user-section">
                <h3>Recent activity</h3>
                <p className="muted user-activity-empty">Activity log coming soon.</p>
              </section>
            </Drawer.Body>

            {canManageMembers ? (
              <Drawer.Footer className="user-drawer-foot">
                {user.status === 'invited' ? (
                  <Button
                    variant="ghost"
                    onClick={() => void resendInvites([user])}
                    isDisabled={busy}
                  >
                    <Icon name="refresh" size={14} />
                    Resend invite
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => setShowResetPassword(true)}
                  isDisabled={busy}
                >
                  <Icon name="refresh" size={14} />
                  Reset password
                </Button>
                <span className="spacer" />
                {user.status === 'suspended' ? (
                  <Button
                    variant="primary"
                    onClick={() => void handleSuspendToggle()}
                    isDisabled={busy}
                  >
                    <Icon name="check" size={14} />
                    Reinstate
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => void handleSuspendToggle()}
                    isDisabled={busy || user.role === USER_ROLES.OWNER}
                  >
                    <Icon name="minus" size={14} />
                    Suspend
                  </Button>
                )}
              </Drawer.Footer>
            ) : null}

            <ResetPasswordModal
              user={user}
              open={showResetPassword}
              onClose={() => setShowResetPassword(false)}
            />

            <InviteLinksModal links={fallbackLinks} onClose={dismissFallback} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  )
}

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="user-drow">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </div>
  )
}

/** Two-letter stand-in for a project logo. */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function statusTone(status: WorkspaceUser['status']): 'teal' | 'amber' | 'red' {
  if (status === 'active') return 'teal'
  if (status === 'invited') return 'amber'
  return 'red'
}
