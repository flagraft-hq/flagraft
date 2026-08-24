import { useEffect, useState, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Button,
  Checkbox,
  Chip,
  Dropdown,
  SearchField,
  Table,
  type Selection,
  type SortDescriptor,
} from '@heroui/react'
import { usersApi } from '../../lib/api'
import { useUsers } from '../../hooks/useUsers'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { WorkspaceUser } from '../../lib/api'
import { USER_ROLES } from '../../lib/roles'
import { useToast } from '../../hooks/useToast'
import { useResendInvite } from '../../hooks/useResendInvite'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { FilterSelect } from '../primitives/FilterSelect'
import { Icon } from '../primitives/Icon'
import { ErrorState } from '../primitives/ErrorState'
import { Pagination } from '../primitives/Pagination'
import { InviteLinksModal } from './InviteLinksModal'
import { UserBulkActionBar } from './UserBulkActionBar'
import { UserDetailDrawer } from './UserDetailDrawer'
import { InviteModal } from './InviteModal'

type StatusFilter = 'all' | 'active' | 'invited' | 'suspended' | 'system'

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25
type SortKey = 'name' | 'role' | 'projects' | 'last'
type SortDir = 'asc' | 'desc'

/** Table column ids that sort, mapped to the key the API expects. */
const SORTABLE: Record<string, SortKey> = {
  name: 'name',
  role: 'role',
  projects: 'projects',
  last: 'last',
}

/**
 * Workspace-wide directory of users: every human + service account, across projects.
 * Differs from project Members (which is per-project).
 */
export function UsersScreen() {
  const toast = useToast()
  const { resendInvites, fallbackLinks, dismissFallback } = useResendInvite()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'last',
    dir: 'desc',
  })
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<WorkspaceUser | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  /** Typing must not fire a request per keystroke. */
  const debouncedQuery = useDebouncedValue(q, 300)

  const { users, total, counts, loading, error, refetch } = useUsers({
    search: debouncedQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    role: roleFilter === 'all' ? undefined : roleFilter,
    sort: sortBy.key,
    dir: sortBy.dir,
    limit,
    offset,
  })

  /**
   * Any change to the filters or sort re-numbers the pages, so page 4 of the
   * old result set is meaningless. Go back to the first page.
   */
  useEffect(() => {
    setOffset((current) => (current === 0 ? current : 0))
  }, [debouncedQuery, statusFilter, roleFilter, sortBy])

  /** Selections are per-page; carrying them across pages would hide them. */
  useEffect(() => {
    setSelected((current) => (current.size === 0 ? current : new Set()))
  }, [offset])

  /**
   * Deep link from the global search: /users?user=<id> opens that user's
   * drawer once the list is loaded. The param is dropped right away so the
   * drawer doesn't reopen on refreshes or after list reloads.
   */
  useEffect(() => {
    const userId = searchParams.get('user')
    if (!userId) return
    setSearchParams({}, { replace: true })
    /**
     * The linked user may sit on any page, so fetch them directly rather than
     * looking through the rows that happen to be loaded.
     */
    usersApi
      .get(userId)
      .then((res) =>
        /** The detail endpoint returns project objects; rows carry plain names. */
        setDetail({ ...res.data, projects: res.data.projects.map((p) => p.name) }),
      )
      .catch(() => {
        /** A stale or bogus link just does nothing. */
      })
  }, [searchParams, setSearchParams])

  /** "Select all" arrives as the string `all` rather than a set of keys. */
  function handleSelectionChange(keys: Selection) {
    setSelected(
      keys === 'all' ? new Set(users.map((u) => u.id)) : new Set(Array.from(keys, String)),
    )
  }

  function handleSortChange(descriptor: SortDescriptor) {
    const key = SORTABLE[String(descriptor.column)]
    if (!key) return
    setSortBy({ key, dir: descriptor.direction === 'ascending' ? 'asc' : 'desc' })
  }

  const sortDescriptor: SortDescriptor = {
    column: sortBy.key,
    direction: sortBy.dir === 'asc' ? 'ascending' : 'descending',
  }

  const selectedUsers = users.filter((u) => selected.has(u.id))
  const anyFilters = q !== '' || statusFilter !== 'all' || roleFilter !== 'all'

  async function refreshUsers() {
    refetch()
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
      await usersApi.cancelInvite(u.id)
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

  function resetFilters() {
    setQ('')
    setStatusFilter('all')
    setRoleFilter('all')
  }

  if (loading) {
    return (
      <div className="users-loading" style={{ padding: '1.5rem' }}>
        <span className="muted">Loading users...</span>
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load users" message={error} onRetry={refetch} />
  }

  return (
    <div className="users-screen dc">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Users</h1>
          <p className="page-header-sub">
            Everyone with access to this workspace across all projects. Project-specific access
            lives under{' '}
            <Link className="users-settings-link" to="/settings?section=members">
              Project settings → Members
            </Link>
            .
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" onClick={() => setShowInvite(true)}>
            <Icon name="plus" size={14} />
            Invite users
          </Button>
        </div>
      </div>

      <div className="users-stats">
        <StatCard
          label="Total users"
          value={counts.all}
          sub={`${counts.active} active, ${counts.system} service`}
          icon="user"
          tone="teal"
        />
        <StatCard
          label="Pending invites"
          value={counts.invited}
          sub={counts.invited > 0 ? 'expires in 7 days' : 'nothing pending'}
          icon="sparkles"
          tone="amber"
          warn={counts.invited > 0}
        />
        <StatCard
          label="Privileged access"
          value={counts.owners + counts.admins}
          sub={`${counts.owners} owner${counts.owners === 1 ? '' : 's'}, ${counts.admins} admin${counts.admins === 1 ? '' : 's'}`}
          icon="shield"
          tone="slate"
        />
      </div>

      <div className="dc-toolbar users-toolbar">
        <SearchField aria-label="Search users" value={q} onChange={setQ}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search by name, email, project..." />
          </SearchField.Group>
        </SearchField>

        <div className="dc-chip-group" role="group" aria-label="Status filter">
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
              className="dc-chip"
              aria-pressed={statusFilter === c.id}
              data-tone={c.tone}
              onClick={() => setStatusFilter(c.id)}
            >
              <span>{c.label}</span>
              <span className="dc-chip-n num">{c.n}</span>
            </button>
          ))}
        </div>

        <span className="users-toolbar-spacer" />

        <FilterSelect
          label="Role filter"
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

      {total === 0 ? (
        <div className="dc-empty users-empty">
          <h3>No users match</h3>
          <p>Try clearing the search or changing the status filter.</p>
          {anyFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              Reset filters
            </Button>
          )}
        </div>
      ) : (
        <div className="users-card dc-card">
          <Table>
            <Table.Content
              aria-label="Workspace users"
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={handleSelectionChange}
              sortDescriptor={sortDescriptor}
              onSortChange={handleSortChange}
              onRowAction={(key) => {
                const user = users.find((u) => u.id === String(key))
                if (user) setDetail(user)
              }}
            >
              <Table.Header>
                <Table.Column id="select" className="cell-check">
                  <Checkbox slot="selection" aria-label="Select all">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Column>
                <Table.Column id="name" isRowHeader allowsSorting>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Person
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="role" allowsSorting className="cell-role">
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Role
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="projects" allowsSorting className="cell-projects">
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Project access
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="last" allowsSorting className="cell-last">
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Last login
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="actions" className="cell-actions">
                  <span className="sr-only">Actions</span>
                </Table.Column>
              </Table.Header>
              <Table.Body items={users}>
                {(u: WorkspaceUser) => (
                  <UserRow
                    user={u}
                    active={detail?.id === u.id}
                    onOpen={() => setDetail(u)}
                    onResend={() => void resendInvites([u])}
                    onSuspendToggle={() => void handleRowSuspendToggle(u)}
                    onCancelInvite={() => void handleCancelInvite(u)}
                  />
                )}
              </Table.Body>
            </Table.Content>
          </Table>

          <div className="dc-table-foot">
            <Pagination
              total={total}
              limit={limit}
              offset={offset}
              onOffsetChange={setOffset}
              onLimitChange={(next) => {
                /** Page numbers change meaning with the size, so start over. */
                setLimit(next)
                setOffset(0)
              }}
              noun="user"
            />
          </div>
        </div>
      )}

      <InviteLinksModal links={fallbackLinks} onClose={dismissFallback} />

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
            /** The row lives on a server page, so re-read it instead of patching locally. */
            setDetail(updated)
            refetch()
          }}
        />
      ) : null}

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onInvited={refetch} />
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
        <div className="users-stat-val num">{value}</div>
        <div className="users-stat-lbl">
          {label}
          {' · '}
          <span className="users-stat-sub">{sub}</span>
        </div>
      </div>
    </div>
  )
}

function RoleChip({ role }: { role: WorkspaceUser['role'] }) {
  return (
    <Chip className={'users-role users-role--' + role} size="sm">
      {role}
    </Chip>
  )
}

interface UserRowProps {
  user: WorkspaceUser
  active: boolean
  onOpen: () => void
  onResend: () => void
  onSuspendToggle: () => void
  onCancelInvite: () => void
}

function UserRow({
  user: u,
  active,
  onOpen,
  onResend,
  onSuspendToggle,
  onCancelInvite,
}: UserRowProps) {
  const relativeDate = useRelativeDate(u.lastLoginAt ?? undefined)
  const isOwner = u.role === USER_ROLES.OWNER

  /** One menu per row, so the action ids are matched here rather than inline. */
  function handleAction(key: string) {
    if (key === 'edit') onOpen()
    else if (key === 'resend') onResend()
    else if (key === 'cancel') onCancelInvite()
    else if (key === 'suspend') onSuspendToggle()
  }

  return (
    <Table.Row
      id={u.id}
      className={
        'users-row' +
        (u.status === 'suspended' ? ' suspended' : '') +
        (u.status === 'invited' ? ' invited' : '')
      }
      data-active={active ? 'true' : undefined}
    >
      <Table.Cell className="cell-check">
        {/**
         * React Aria composes this label with the row header cell, so the
         * screen reader hears "Select" followed by the person's own name.
         */}
        <Checkbox slot="selection" aria-label="Select">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </Table.Cell>

      <Table.Cell className="cell-person">
        <div className="users-person">
          {/** The initials duplicate the name, so keep them out of the row's announcement. */}
          <span className={'avatar sm color-' + u.tone} aria-hidden="true">
            {u.initials}
          </span>
          <div className="users-person-text">
            <div className="users-name">
              {u.name}
              {u.isSystem ? (
                <Chip className="users-tag users-tag--slate" size="sm">
                  service
                </Chip>
              ) : null}
              {u.status === 'invited' ? (
                <Chip className="users-tag users-tag--amber" size="sm">
                  invited
                </Chip>
              ) : null}
              {u.status === 'suspended' ? (
                <Chip className="users-tag users-tag--red" size="sm">
                  suspended
                </Chip>
              ) : null}
            </div>
            <div className="users-email">{u.email}</div>
          </div>
        </div>
      </Table.Cell>

      <Table.Cell className="cell-role">
        <RoleChip role={u.role} />
      </Table.Cell>

      <Table.Cell className="cell-projects">
        {u.projects.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <span className="users-projects">{u.projects.join(', ')}</span>
        )}
      </Table.Cell>

      <Table.Cell className="cell-last">
        <span className={'users-last' + (u.lastLoginAt == null ? ' never' : '')}>
          {u.lastLoginAt == null ? 'Never' : relativeDate}
        </span>
      </Table.Cell>

      <Table.Cell className="cell-actions">
        <Dropdown>
          <Dropdown.Trigger className="dc-icon-btn" aria-label={`Actions for ${u.name}`}>
            <Icon name="more" size={16} />
          </Dropdown.Trigger>
          <Dropdown.Popover className="dc-popover" placement="bottom end">
            <Dropdown.Menu onAction={(key) => handleAction(String(key))}>
              {u.status === 'invited' ? (
                <>
                  <Dropdown.Item id="resend">Resend invite</Dropdown.Item>
                  <Dropdown.Item id="cancel" className="users-menu-danger">
                    Cancel invite
                  </Dropdown.Item>
                </>
              ) : (
                <>
                  <Dropdown.Item id="edit">Edit user</Dropdown.Item>
                  <Dropdown.Item
                    id="suspend"
                    isDisabled={isOwner}
                    className={u.status === 'suspended' ? undefined : 'users-menu-danger'}
                  >
                    {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                  </Dropdown.Item>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Table.Cell>
    </Table.Row>
  )
}
