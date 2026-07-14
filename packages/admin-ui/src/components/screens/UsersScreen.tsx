import { useEffect, useMemo, useState, ReactNode } from 'react'
import { usersApi } from '../../lib/api'
import type { WorkspaceUser } from '../../lib/api'
import { USER_ROLES } from '../../lib/roles'
import { useToast } from '../../hooks/useToast'
import { useResendInvite } from '../../hooks/useResendInvite'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { Button } from '../primitives/Button'
import { Checkbox } from '../primitives/Checkbox'
import { Icon } from '../primitives/Icon'
import { Select } from '../primitives/Select'
import { Tip } from '../primitives/Tip'
import { ErrorState } from '../primitives/ErrorState'
import { UserBulkActionBar } from './UserBulkActionBar'
import { UserDetailDrawer } from './UserDetailDrawer'
import { InviteModal } from './InviteModal'

type StatusFilter = 'all' | 'active' | 'invited' | 'suspended' | 'system'
type SortKey = 'name' | 'role' | 'projects' | 'last'
type SortDir = 'asc' | 'desc'

/**
 * Workspace-wide directory of users: every human + service account, across projects.
 * Differs from project Members (which is per-project).
 */
export function UsersScreen() {
  const toast = useToast()
  const resendInvite = useResendInvite()
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'last',
    dir: 'desc',
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<WorkspaceUser | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    usersApi
      .list()
      .then((res) => {
        if (cancelled) return
        setUsers(res.data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load users')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const c = { all: users.length, active: 0, invited: 0, suspended: 0, system: 0 }
    users.forEach((u) => {
      if (u.isSystem) c.system++
      else if (u.status === 'active') c.active++
      else if (u.status === 'invited') c.invited++
      else if (u.status === 'suspended') c.suspended++
    })
    return c
  }, [users])

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase()
    const xs = users.filter((u) => {
      if (statusFilter === 'system') {
        if (!u.isSystem) return false
      } else if (statusFilter !== 'all') {
        if (u.isSystem) return false
        if (u.status !== statusFilter) return false
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (Q) {
        const hay = (u.name + ' ' + u.email + ' ' + u.projects.join(' ')).toLowerCase()
        if (!hay.includes(Q)) return false
      }
      return true
    })
    const ord = sortBy.dir === 'asc' ? 1 : -1
    xs.sort((a, b) => {
      if (sortBy.key === 'name') return a.name.localeCompare(b.name) * ord
      if (sortBy.key === 'role') {
        const order: Record<string, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 }
        return ((order[a.role] ?? 9) - (order[b.role] ?? 9)) * ord
      }
      if (sortBy.key === 'projects') return (a.projects.length - b.projects.length) * ord
      if (sortBy.key === 'last') {
        const ax = a.lastActiveAt ?? ''
        const bx = b.lastActiveAt ?? ''
        return ax.localeCompare(bx) * ord
      }
      return 0
    })
    return xs
  }, [users, q, statusFilter, roleFilter, sortBy])

  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id))
  const someChecked = filtered.some((u) => selected.has(u.id)) && !allChecked

  function toggleAll() {
    const ns = new Set(selected)
    if (allChecked) filtered.forEach((u) => ns.delete(u.id))
    else filtered.forEach((u) => ns.add(u.id))
    setSelected(ns)
  }

  function toggleOne(id: string) {
    const ns = new Set(selected)
    if (ns.has(id)) ns.delete(id)
    else ns.add(id)
    setSelected(ns)
  }

  const selectedUsers = users.filter((u) => selected.has(u.id))

  async function refreshUsers() {
    const res = await usersApi.list()
    setUsers(res.data)
  }

  async function handleRowSuspendToggle(u: WorkspaceUser) {
    const nextStatus = u.status === 'suspended' ? 'active' : 'suspended'
    try {
      await usersApi.patch(u.id, { status: nextStatus })
      toast.push({
        title: nextStatus === 'suspended' ? 'User suspended' : 'User reinstated',
        msg: u.email,
        variant: 'success',
      })
      await refreshUsers()
    } catch (err) {
      toast.push({
        title: 'Failed to update user',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  async function handleCancelInvite(u: WorkspaceUser) {
    try {
      await usersApi.delete(u.id)
      toast.push({ title: 'Invite canceled', msg: u.email, variant: 'success' })
      await refreshUsers()
    } catch (err) {
      toast.push({
        title: 'Failed to cancel invite',
        msg: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  function setSort(key: SortKey) {
    setSortBy((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function sortHead(key: SortKey, label: string) {
    return (
      <button className="sort-head" onClick={() => setSort(key)}>
        <span>{label}</span>
        <span className={'sort-arrow' + (sortBy.key === key ? ' on' : '')}>
          <Icon
            name="chevronDown"
            size={11}
            style={{
              transform: sortBy.key === key && sortBy.dir === 'asc' ? 'rotate(180deg)' : 'none',
            }}
          />
        </span>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="users-loading" style={{ padding: 24 }}>
        <span className="muted">Loading users...</span>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load users"
        message={error}
        onRetry={() => {
          setError(null)
          setLoading(true)
          usersApi
            .list()
            .then((res) => setUsers(res.data))
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Failed to load users'),
            )
            .finally(() => setLoading(false))
        }}
      />
    )
  }

  return (
    <div className="users-screen">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Users</h1>
          <p className="page-header-sub">
            Everyone with access to this workspace across all projects. Project-specific access
            lives under{' '}
            <a className="users-settings-link" href="/settings/projects">
              Project settings → Members
            </a>
            .
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" leftIcon="plus" onClick={() => setShowInvite(true)}>
            Invite user
          </Button>
        </div>
      </div>

      <div className="users-stats">
        <StatCard
          label="Total users"
          value={counts.all}
          sub={
            <>
              {counts.active} active · {counts.system} service
            </>
          }
          icon="user"
          tone="teal"
        />
        <StatCard
          label="Pending invites"
          value={counts.invited}
          sub={
            counts.invited > 0 ? (
              <>
                Expires in <b>7&nbsp;days</b>
              </>
            ) : (
              'Nothing pending'
            )
          }
          icon="sparkles"
          tone="amber"
          warn={counts.invited > 0}
        />
        <StatCard
          label="Seats"
          value={
            <>
              {users.length}
              <span className="unit">/25</span>
            </>
          }
          sub={`${Math.max(0, 25 - users.length)} remaining`}
          icon="layers"
          tone="slate"
        />
      </div>

      <div className="users-toolbar">
        <div className="users-search">
          <Icon name="search" size={14} className="ic" />
          <input
            placeholder="Search by name, email, project..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button
              className="users-search-clear"
              onClick={() => setQ('')}
              aria-label="Clear search"
            >
              <Icon name="x" size={12} />
            </button>
          ) : null}
        </div>

        <div className="chip-group" role="tablist" aria-label="Status filter">
          {(
            [
              { id: 'all', label: 'All', n: counts.all },
              { id: 'active', label: 'Active', n: counts.active },
              { id: 'invited', label: 'Invited', n: counts.invited, tone: 'amber' },
              { id: 'suspended', label: 'Suspended', n: counts.suspended, tone: 'red' },
              { id: 'system', label: 'Service', n: counts.system },
            ] as { id: StatusFilter; label: string; n: number; tone?: string }[]
          ).map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={statusFilter === c.id}
              data-tone={c.tone}
              onClick={() => setStatusFilter(c.id)}
            >
              <span>{c.label}</span>
              <span className="chip-n num">{c.n}</span>
            </button>
          ))}
        </div>

        <span style={{ flex: 1 }} />

        <Select
          className="select-sm"
          aria-label="Role filter"
          placeholder=""
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'owner', label: 'owner' },
            { value: 'admin', label: 'admin' },
            { value: 'editor', label: 'editor' },
            { value: 'viewer', label: 'viewer' },
          ]}
        />
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={toggleAll}
                  ariaLabel="Select all"
                />
              </th>
              <th>{sortHead('name', 'Person')}</th>
              <th>{sortHead('role', 'Role')}</th>
              <th>{sortHead('projects', 'Project access')}</th>
              <th>{sortHead('last', 'Last active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-filtered" style={{ padding: 32, textAlign: 'center' }}>
                    <div className="ill" style={{ marginBottom: 10 }}>
                      <Icon name="user" size={28} style={{ color: 'var(--text-3)' }} />
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>No users match</h3>
                    <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                      Try clearing the search or changing the status filter.
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setQ('')
                        setStatusFilter('all')
                        setRoleFilter('all')
                      }}
                    >
                      Reset filters
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  selected={selected.has(u.id)}
                  active={detail?.id === u.id}
                  onSelect={() => toggleOne(u.id)}
                  onOpen={() => setDetail(u)}
                  onResend={() => void resendInvite(u)}
                  onSuspendToggle={() => void handleRowSuspendToggle(u)}
                  onCancelInvite={() => void handleCancelInvite(u)}
                />
              ))
            )}
          </tbody>
        </table>

        <div className="users-table-foot">
          <span className="muted" style={{ fontSize: 12 }}>
            {filtered.length} of {users.length} users
          </span>
          <span style={{ flex: 1 }} />
        </div>
      </div>

      <UserBulkActionBar
        selectedUsers={selectedUsers}
        onDone={async () => {
          await refreshUsers()
          setSelected(new Set())
        }}
        onCancel={() => setSelected(new Set())}
      />

      {detail ? (
        <UserDetailDrawer
          user={detail}
          onClose={() => setDetail(null)}
          onUpdated={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
            setDetail(updated)
          }}
        />
      ) : null}

      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={() => {
          usersApi
            .list()
            .then((res) => setUsers(res.data))
            .catch(() => {})
        }}
      />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: ReactNode
  sub: ReactNode
  icon: 'user' | 'sparkles' | 'shield' | 'layers'
  tone: 'teal' | 'amber' | 'slate'
  warn?: boolean
}

function StatCard({ label, value, sub, icon, tone, warn }: StatCardProps) {
  return (
    <div className={'users-stat' + (warn ? ' warn' : '')} data-tone={tone}>
      <div className="users-stat-ic">
        <Icon name={icon} size={14} />
      </div>
      <div className="users-stat-body">
        <div className="users-stat-lbl">{label}</div>
        <div className="users-stat-val num">{value}</div>
        <div className="users-stat-sub">{sub}</div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: WorkspaceUser['role'] }) {
  const tone = role === USER_ROLES.OWNER ? 'amber' : role === USER_ROLES.ADMIN ? 'teal' : 'slate'
  return (
    <span className={'badge badge-tone-' + tone}>
      <span className="role-dot" />
      {role}
    </span>
  )
}

interface UserRowProps {
  user: WorkspaceUser
  selected: boolean
  active: boolean
  onSelect: () => void
  onOpen: () => void
  onResend: () => void
  onSuspendToggle: () => void
  onCancelInvite: () => void
}

function UserRow({
  user: u,
  selected,
  active,
  onSelect,
  onOpen,
  onResend,
  onSuspendToggle,
  onCancelInvite,
}: UserRowProps) {
  const relativeDate = useRelativeDate(u.lastActiveAt ?? undefined)

  return (
    <tr
      className={
        'users-row' +
        (selected ? ' selected' : '') +
        (u.status === 'suspended' ? ' suspended' : '') +
        (u.status === 'invited' ? ' invited' : '')
      }
      data-active={active ? 'true' : undefined}
      onClick={onOpen}
    >
      <td className="col-check" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onSelect} ariaLabel={'Select ' + u.name} />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className={'avatar sm color-' + u.tone}>{u.initials}</span>
          <div style={{ minWidth: 0 }}>
            <div className="users-name">
              {u.name}
              {u.isSystem ? (
                <span style={{ marginLeft: 6 }} className="badge badge-tone-slate">
                  <Icon name="bolt" size={9} /> service
                </span>
              ) : null}
              {u.status === 'invited' ? (
                <span style={{ marginLeft: 6 }} className="badge badge-tone-amber">
                  <span className="role-dot" /> invited
                </span>
              ) : null}
              {u.status === 'suspended' ? (
                <span style={{ marginLeft: 6 }} className="badge badge-tone-red">
                  <span className="role-dot" /> suspended
                </span>
              ) : null}
            </div>
            <div className="users-email mono">{u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <RoleBadge role={u.role} />
      </td>
      <td>
        <div className="users-projects">
          {u.projects.slice(0, 2).map((p) => (
            <span key={p} className="proj-chip">
              {p}
            </span>
          ))}
          {u.projects.length > 2 ? (
            <span className="proj-more">+{u.projects.length - 2}</span>
          ) : null}
        </div>
      </td>
      <td>
        <span className={'users-last mono' + (u.lastActiveAt == null ? ' never' : '')}>
          {u.lastActiveAt == null ? 'never' : relativeDate}
        </span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 2 }}>
          {u.status === 'invited' ? (
            <>
              <Tip tip="Resend invite">
                <button className="icon-btn" aria-label="Resend invite" onClick={onResend}>
                  <Icon name="refresh" size={13} />
                </button>
              </Tip>
              <Tip tip="Cancel invite">
                <button
                  className="icon-btn danger"
                  aria-label="Cancel invite"
                  onClick={onCancelInvite}
                >
                  <Icon name="x" size={13} />
                </button>
              </Tip>
            </>
          ) : (
            <>
              <Tip tip="Edit user">
                <button className="icon-btn" aria-label="Edit user" onClick={onOpen}>
                  <Icon name="edit" size={13} />
                </button>
              </Tip>
              <Tip
                tip={
                  u.role === USER_ROLES.OWNER
                    ? 'Transfer ownership first'
                    : u.status === 'suspended'
                      ? 'Reinstate'
                      : 'Suspend'
                }
              >
                <button
                  className="icon-btn"
                  disabled={u.role === USER_ROLES.OWNER}
                  aria-label={u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                  onClick={onSuspendToggle}
                >
                  <Icon name={u.status === 'suspended' ? 'check' : 'minus'} size={13} />
                </button>
              </Tip>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
