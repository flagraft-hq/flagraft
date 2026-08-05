import React from 'react'
import { Icon, IconName } from '../primitives/Icon'
import { useAuth } from '../../contexts/AuthContext'
import { USER_ROLES } from '../../lib/roles'

export type NavItemId = 'flags' | 'audit' | 'environments' | 'keys' | 'users' | 'settings'

export interface SideNavProps {
  current: NavItemId
  onNav: (id: NavItemId) => void
}

interface NavItem {
  id: NavItemId
  label: string
  icon: IconName
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'flags', label: 'Flags', icon: 'flag' },
      { id: 'audit', label: 'Audit log', icon: 'history' },
    ],
  },
  {
    group: 'CONFIGURE',
    items: [
      { id: 'environments', label: 'Environments', icon: 'layers' },
      { id: 'keys', label: 'API keys', icon: 'key' },
      { id: 'users', label: 'Users', icon: 'user' as const },
      { id: 'settings', label: 'Project settings', icon: 'settings' },
    ],
  },
]

export function SideNav({ current, onNav }: SideNavProps) {
  const { user, logout } = useAuth()

  /**
   * Only owners and admins can load the Users screen, so for everyone else
   * the link would go nowhere but an error state.
   */
  const canSeeUsers = user?.role === USER_ROLES.OWNER || user?.role === USER_ROLES.ADMIN
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.id !== 'users' || canSeeUsers),
  }))

  return (
    <nav className="sidenav">
      {groups.map((g) => (
        <React.Fragment key={g.group}>
          <div className="nav-section">{g.group}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              className="nav-item"
              aria-current={current === it.id ? 'page' : undefined}
              onClick={() => onNav(it.id)}
            >
              <Icon name={it.icon} size={16} />
              <span>{it.label}</span>
            </button>
          ))}
        </React.Fragment>
      ))}
      {user && (
        <div className="sidenav-footer">
          <div className="sidenav-user-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div className="sidenav-user-info">
            <div className="sidenav-user-name">{user.name}</div>
            <div className="sidenav-user-role mono">{user.role}</div>
          </div>
          <button className="icon-btn" onClick={() => void logout()} aria-label="Sign out">
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
      )}
    </nav>
  )
}
