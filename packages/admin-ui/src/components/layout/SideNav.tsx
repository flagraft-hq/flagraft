import React from 'react';
import { Icon, IconName } from '../primitives/Icon';
import { Kbd } from '../primitives/Kbd';

export type NavItemId = 'flags' | 'overrides' | 'audit' | 'environments' | 'keys' | 'settings';

export interface SideNavProps {
  current: NavItemId;
  onNav: (id: NavItemId) => void;
}

interface NavItem {
  id: NavItemId;
  label: string;
  icon: IconName;
  shortcut?: string[];
  count?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'flags', label: 'Flags', icon: 'flag', shortcut: ['g', 'f'], count: 24 },
      { id: 'overrides', label: 'Overrides', icon: 'target', shortcut: ['g', 'o'], count: 17 },
      { id: 'audit', label: 'Audit log', icon: 'history', shortcut: ['g', 'a'] },
    ],
  },
  {
    group: 'CONFIGURE',
    items: [
      { id: 'environments', label: 'Environments', icon: 'layers', shortcut: ['g', 'e'] },
      { id: 'keys', label: 'API keys', icon: 'key', shortcut: ['g', 'k'] },
      { id: 'settings', label: 'Project settings', icon: 'settings' },
    ],
  },
];

export function SideNav({ current, onNav }: SideNavProps) {
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
              {it.count !== undefined ? (
                <span className="badge-count num">{it.count}</span>
              ) : null}
              {it.shortcut ? (
                <span className="kbd-hint">
                  <Kbd keys={it.shortcut} />
                </span>
              ) : null}
            </button>
          ))}
        </React.Fragment>
      ))}
      <div className="sidenav-footer">
        <div className="user-avatar">KS</div>
        <div className="user-info">
          <div className="user-name">Kochar S.</div>
          <div className="user-role">root</div>
        </div>
        <Icon name="chevronDown" size={14} className="muted" />
      </div>
    </nav>
  );
}
