import { useState } from 'react'
import type { WorkspaceUser } from '../../lib/api'
import { usersApi } from '../../lib/api'
import { useProject } from '../../contexts/ProjectContext'
import { useToast } from '../../hooks/useToast'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { Button } from '../primitives/Button'
import { CopyButton } from '../primitives/CopyButton'
import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'

interface UserDetailDrawerProps {
  user: WorkspaceUser
  onClose: () => void
  onUpdated?: (user: WorkspaceUser) => void
}

/**
 * Right-anchored 480px overlay showing details for one workspace user.
 * Closes on Escape or clicking the backdrop.
 */
export function UserDetailDrawer({ user, onClose, onUpdated }: UserDetailDrawerProps) {
  const toast = useToast()
  const { projects } = useProject()
  const [showAddProject, setShowAddProject] = useState(false)
  const [busy, setBusy] = useState(false)
  const relativeLastActive = useRelativeDate(user.lastActiveAt ?? undefined)

  useKeyboardShortcuts({ Escape: onClose })

  async function handleResetPassword() {
    setBusy(true)
    try {
      const res = await usersApi.resetPassword(user.id)
      toast.push({
        title: 'Password reset',
        msg: 'Temporary password: ' + res.data.tempPassword,
      })
    } catch (err) {
      toast.push({
        title: 'Failed to reset password',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSuspendToggle() {
    setBusy(true)
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended'
    try {
      const res = await usersApi.patch(user.id, { status: nextStatus })
      toast.push({ title: nextStatus === 'suspended' ? 'User suspended' : 'User reinstated' })
      onUpdated?.(res.data)
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
    setBusy(true)
    try {
      await usersApi.addToProject(user.id, projectId)
      toast.push({ title: 'Added to project' })
      setShowAddProject(false)
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

  const statusTone = user.status === 'active' ? 'teal' : user.status === 'invited' ? 'amber' : 'red'

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="user-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={'User detail: ' + user.name}
      >
        <div className="user-drawer-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
          <span className="spacer" style={{ flex: 1 }} />
          <CopyButton value={user.id} iconOnly tip="Copy user ID" />
          <Tip tip="Open audit">
            <button className="icon-btn" aria-label="Open audit">
              <Icon name="history" size={14} />
            </button>
          </Tip>
        </div>

        <div className="user-drawer-hero">
          <span className={'avatar lg color-' + user.tone}>{user.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{user.name}</h2>
            <div className="user-drawer-email mono">{user.email}</div>
            <div
              className="row"
              style={{ gap: 6, marginTop: 10, flexWrap: 'wrap', display: 'flex' }}
            >
              <span className={'badge badge-tone-' + roleTone(user.role)}>
                <span className="role-dot" /> {user.role}
              </span>
              <span className={'badge badge-tone-' + statusTone}>
                <span className="role-dot" /> {user.status}
              </span>
              {user.isSystem ? (
                <span className="badge badge-tone-slate">
                  <Icon name="bolt" size={9} /> service
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="user-drawer-body">
          <section className="user-section">
            <h3>Details</h3>
            <DRow label="User ID" value={<span className="mono">{user.id}</span>} />
            <DRow label="Joined" value={<span className="mono">{user.createdAt}</span>} />
            <DRow
              label="Last active"
              value={
                <span className="mono">
                  {user.lastActiveAt == null ? 'never' : relativeLastActive}
                </span>
              }
            />
            <DRow label="2FA" value={<TwoFAValue value={user.twoFa} />} />
            <DRow
              label="Source"
              value={
                <span className="mono">{user.isSystem ? 'service-account' : 'scim · okta'}</span>
              }
            />
          </section>

          <section className="user-section">
            <h3>Project access · {user.projects.length}</h3>
            <div className="user-projects">
              {user.projects.map((p) => (
                <div key={p} className="user-project">
                  <span
                    className="proj-avatar"
                    style={{ width: 28, height: 28, fontSize: 11, borderRadius: 8 }}
                  >
                    {p
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {user.role}
                    </div>
                  </div>
                  <Tip tip="Remove from project">
                    <button
                      className="icon-btn"
                      onClick={() => void handleRemoveFromProject(p)}
                      disabled={busy}
                      aria-label={'Remove from ' + p}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </Tip>
                </div>
              ))}
              {showAddProject ? (
                <div
                  className="user-add-project-picker"
                  style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                >
                  <select
                    className="select"
                    aria-label="Choose project"
                    onChange={(e) => {
                      if (e.target.value) void handleAddToProject(e.target.value)
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose project...
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Activity log coming soon.
            </p>
          </section>
        </div>

        <div className="user-drawer-foot">
          <Button
            variant="ghost"
            leftIcon="refresh"
            onClick={() => void handleResetPassword()}
            disabled={busy}
          >
            Reset password
          </Button>
          <Button
            variant="ghost"
            leftIcon="shield"
            onClick={() => toast.push({ title: '2FA reset link sent', msg: user.email })}
            disabled={busy}
          >
            Reset 2FA
          </Button>
          <span className="spacer" style={{ flex: 1 }} />
          {user.status === 'suspended' ? (
            <Button
              variant="primary"
              leftIcon="check"
              onClick={() => void handleSuspendToggle()}
              disabled={busy}
            >
              Reinstate
            </Button>
          ) : (
            <Button
              variant="danger"
              leftIcon="minus"
              onClick={() => void handleSuspendToggle()}
              disabled={busy || user.role === 'owner'}
            >
              Suspend
            </Button>
          )}
        </div>
      </aside>
    </div>
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

function TwoFAValue({ value }: { value: WorkspaceUser['twoFa'] }) {
  if (value === 'none')
    return (
      <span className="twofa none">
        <Icon name="alert" size={11} /> none
      </span>
    )
  const labels: Record<Exclude<WorkspaceUser['twoFa'], 'none'>, string> = {
    app: 'authenticator',
    key: 'security key',
    sms: 'sms',
  }
  const icons: Record<Exclude<WorkspaceUser['twoFa'], 'none'>, 'shield' | 'key' | 'info'> = {
    app: 'shield',
    key: 'key',
    sms: 'info',
  }
  return (
    <span className="twofa ok">
      <Icon name={icons[value]} size={11} /> {labels[value]}
    </span>
  )
}

function roleTone(role: WorkspaceUser['role']): 'amber' | 'teal' | 'slate' {
  if (role === 'owner') return 'amber'
  if (role === 'admin') return 'teal'
  return 'slate'
}
