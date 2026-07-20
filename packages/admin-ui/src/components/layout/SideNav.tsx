import React from 'react'
import { Icon, IconName } from '../primitives/Icon'
import { Kbd } from '../primitives/Kbd'
import { useAuth } from '../../contexts/AuthContext'

export type NavItemId = 'flags' | 'audit' | 'environments' | 'keys' | 'users' | 'settings'

export interface SideNavProps {
  current: NavItemId
  onNav: (id: NavItemId) => void
}

interface NavItem {
  id: NavItemId
  label: string
  icon: IconName
  shortcut?: string[]
  count?: number
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'flags', label: 'Flags', icon: 'flag', shortcut: ['g', 'f'], count: 24 },
      { id: 'audit', label: 'Audit log', icon: 'history', shortcut: ['g', 'a'] },
    ],
  },
  {
    group: 'CONFIGURE',
    items: [
      { id: 'environments', label: 'Environments', icon: 'layers', shortcut: ['g', 'e'] },
      { id: 'keys', label: 'API keys', icon: 'key', shortcut: ['g', 'k'] },
      { id: 'users', label: 'Users', icon: 'user' as const },
      { id: 'settings', label: 'Project settings', icon: 'settings' },
    ],
  },
]

export function SideNav({ current, onNav }: SideNavProps) {
  const { user, logout } = useAuth()
  return (
    <nav className="sidenav">
      {NAV.map((g) => (
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
              {it.count !== undefined ? <span className="badge-count num">{it.count}</span> : null}
              {it.shortcut ? (
                <span className="kbd-hint">
                  <Kbd keys={it.shortcut} />
                </span>
              ) : null}
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
