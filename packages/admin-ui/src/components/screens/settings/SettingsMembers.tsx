import { useEffect, useState } from 'react'

import { usersApi, ApiError, type WorkspaceUser } from '../../../lib/api'
import { useAuth } from '../../../contexts/AuthContext'
import { useProject } from '../../../contexts/ProjectContext'
import { useToast } from '../../../hooks/useToast'
import { useUsers } from '../../../hooks/useUsers'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePermissions } from '../../../hooks/usePermissions'
import { useRelativeDate } from '../../../hooks/useRelativeDate'
import { USER_ROLES, type UserRole } from '../../../lib/roles'
import { Badge } from '../../primitives/Badge'
import { Button } from '../../primitives/Button'
import { Denied } from '../../primitives/Denied'
import { ErrorState } from '../../primitives/ErrorState'
import { FormError } from '../../primitives/FormError'
import { Icon } from '../../primitives/Icon'
import { Modal } from '../../primitives/Modal'
import { Pagination } from '../../primitives/Pagination'
import { Select } from '../../primitives/Select'
import { Tip } from '../../primitives/Tip'
import { InviteModal } from '../InviteModal'
import { SettingsCard } from './SettingsCard'

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25

const ROLE_OPTIONS: UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.EDITOR,
  USER_ROLES.VIEWER,
]

/** The capability matrix is documentation — it describes what each role can do. */
const CAPABILITIES: { label: string; roles: [boolean, boolean, boolean, boolean] }[] = [
  { label: 'Read flags & targeting', roles: [true, true, true, true] },
  { label: 'Toggle flags in dev / staging', roles: [true, true, true, false] },
  { label: 'Toggle flags in production', roles: [true, true, false, false] },
  { label: 'Manage environments', roles: [true, true, false, false] },
  { label: 'Issue API keys', roles: [true, true, false, false] },
  { label: 'Edit project settings', roles: [true, true, false, false] },
  { label: 'Transfer or delete project', roles: [true, false, false, false] },
]

export function SettingsMembers() {
  const toast = useToast()
  const { user } = useAuth()
  const { activeProject } = useProject()
  const { canProjectAdmin } = usePermissions()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<WorkspaceUser | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  /** Typing must not fire a request per keystroke. */
  const debouncedSearch = useDebouncedValue(search, 300)

  /** The server scopes the list to this project; no client-side filtering. */
  const {
    users: visible,
    total,
    loading,
    error,
    refetch,
  } = useUsers({
    projectId: activeProject?.id,
    search: debouncedSearch,
    role: roleFilter === 'all' ? undefined : roleFilter,
    limit,
    offset,
  })

  /** Filter changes re-number the pages, so return to the first one. */
  useEffect(() => {
    setOffset((current) => (current === 0 ? current : 0))
  }, [debouncedSearch, roleFilter, activeProject?.id])

  async function changeRole(member: WorkspaceUser, role: UserRole) {
    try {
      await usersApi.patch(member.id, { role })
      toast.push({ title: `${member.name} is now ${role}`, variant: 'success' })
      refetch()
    } catch (err) {
      toast.push({
        title: err instanceof ApiError ? err.message : 'Failed to change role',
        variant: 'error',
      })
    }
  }

  return (
    <>
      <SettingsCard
        title="Members"
        sub="People with access to this project. Roles are workspace-wide."
        footer={
          <>
            <Pagination
              total={total}
              limit={limit}
              offset={offset}
              onOffsetChange={setOffset}
              onLimitChange={(next) => {
                setLimit(next)
                setOffset(0)
              }}
              noun="member"
            />
            <Denied when={!canProjectAdmin} reason="Only owners and admins can invite members">
              <Button
                variant="primary"
                leftIcon="plus"
                disabled={!canProjectAdmin}
                onClick={() => setInviteOpen(true)}
              >
                Invite member
              </Button>
            </Denied>
          </>
        }
      >
        <div className="members-toolbar">
          <div className="search-input">
            <Icon name="search" size={14} className="search-ico" />
            <input
              className="filter-search"
              placeholder="Search by name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="select-sm"
            aria-label="Role filter"
            placeholder=""
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'All roles' },
              ...ROLE_OPTIONS.map((r) => ({ value: r, label: r })),
            ]}
          />
        </div>

        {error ? (
          <ErrorState title="Failed to load members" message={error} onRetry={refetch} />
        ) : loading ? (
          <div className="ctx-inline-state">Loading members…</div>
        ) : visible.length === 0 ? (
          <div className="ctx-inline-state">No members match.</div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Last login</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isSelf={m.id === user?.id}
                  canManage={canProjectAdmin}
                  onChangeRole={(role) => void changeRole(m, role)}
                  onSuspend={() => setSuspendTarget(m)}
                />
              ))}
            </tbody>
          </table>
        )}
      </SettingsCard>

      <SettingsCard title="What each role can do">
        <div className="role-matrix">
          <div className="role-matrix-row head">
            <div />
            <div>
              <Badge variant="danger" dot>
                owner
              </Badge>
            </div>
            <div>
              <Badge variant="success" dot>
                admin
              </Badge>
            </div>
            <div>
              <Badge variant="warning" dot>
                editor
              </Badge>
            </div>
            <div>
              <Badge variant="default" dot>
                viewer
              </Badge>
            </div>
          </div>
          {CAPABILITIES.map((c) => (
            <div className="role-matrix-row" key={c.label}>
              <div className="lbl">{c.label}</div>
              {c.roles.map((allowed, i) => (
                <div key={i}>
                  {allowed ? (
                    <Icon name="check" size={14} />
                  ) : (
                    <Icon name="minus" size={14} className="muted" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </SettingsCard>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={refetch} />

      <SuspendDialog
        member={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onSuspended={() => {
          setSuspendTarget(null)
          refetch()
        }}
      />
    </>
  )
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onChangeRole,
  onSuspend,
}: {
  member: WorkspaceUser
  isSelf: boolean
  /** False for editors and viewers, who may only read the member list. */
  canManage: boolean
  onChangeRole: (role: UserRole) => void
  onSuspend: () => void
}) {
  const relative = useRelativeDate(member.lastLoginAt ?? undefined)
  const locked = member.role === USER_ROLES.OWNER || isSelf || !canManage

  return (
    <tr>
      <td>
        <div className="member-cell">
          <span
            className={`avatar color-${member.tone}`}
            data-system={member.isSystem ? 'true' : undefined}
          >
            {member.initials}
          </span>
          <div>
            <div className="member-name">
              {member.name}
              {member.isSystem ? (
                <span style={{ marginLeft: 6 }}>
                  <Badge>service</Badge>
                </span>
              ) : null}
              {member.status !== 'active' ? (
                <span style={{ marginLeft: 6 }}>
                  <Badge variant={member.status === 'suspended' ? 'danger' : 'warning'}>
                    {member.status}
                  </Badge>
                </span>
              ) : null}
            </div>
            <div className="member-email mono">{member.email}</div>
          </div>
        </div>
      </td>
      <td>
        <select
          className="select-input role-select"
          value={member.role}
          disabled={locked}
          onChange={(e) => onChangeRole(e.target.value as UserRole)}
          aria-label={`Role for ${member.name}`}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className="mono muted" style={{ fontSize: '0.75rem' }}>
          {member.lastLoginAt == null ? 'never' : relative}
        </span>
      </td>
      <td>
        <div className="ctx-row-actions">
          <Tip
            tip={
              !canManage
                ? 'Only owners and admins can manage members'
                : locked
                  ? 'You can’t suspend an owner or yourself'
                  : 'Suspend member'
            }
            position="left"
          >
            <button
              className="icon-btn"
              aria-label={`Suspend ${member.name}`}
              disabled={locked || member.status === 'suspended'}
              onClick={onSuspend}
            >
              <Icon name="trash" size={13} />
            </button>
          </Tip>
        </div>
      </td>
    </tr>
  )
}

function SuspendDialog({
  member,
  onClose,
  onSuspended,
}: {
  member: WorkspaceUser | null
  onClose: () => void
  onSuspended: (id: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!member) return
    setBusy(true)
    setError(null)
    try {
      await usersApi.patch(member.id, { status: 'suspended' })
      toast.push({ title: `${member.name} suspended`, variant: 'success' })
      onSuspended(member.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend member')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={member !== null} onClose={onClose}>
      <Modal.Header>Suspend member</Modal.Header>
      <Modal.Body>
        <FormError message={error} />
        <p>
          Suspend <strong>{member?.name}</strong>? They lose access to every project until an admin
          reactivates them from the Users screen.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
          {busy ? 'Suspending…' : 'Suspend'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
