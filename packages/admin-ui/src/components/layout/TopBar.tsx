import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'
import { GlobalSearch } from './GlobalSearch'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { Env } from '../../lib/types'

/** Environment slugs are project-defined, so this is just a string. */
export type EnvSlug = string

export interface ProjectInfo {
  id: string
  name: string
  slug: string
}

export interface TopBarProps {
  project: ProjectInfo
  environments: Env[]
  onSwitchProject: () => void
  activeEnv: EnvSlug
  onChangeEnv: (env: EnvSlug) => void
  onShowHelp: () => void
}

export function TopBar({
  project,
  environments,
  onSwitchProject,
  activeEnv,
  onChangeEnv,
  onShowHelp,
}: TopBarProps) {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()

  function handleToggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="brand">
        <span className="brand-mark">FR</span>
        <span>Flagraft</span>
      </div>

      {/* Project switcher */}
      <button className="project-switcher" onClick={onSwitchProject} aria-label="Switch project">
        <Icon name="layers" size={14} className="muted" />
        <span className="proj-name">{project.name}</span>
        <span className="proj-slug mono">/{project.slug}</span>
        <Icon name="chevronDown" size={14} className="muted" />
      </button>

      {/* Environment chips */}
      <div className="env-chips" role="tablist" aria-label="Environment scope">
        {environments.map((e) => (
          <button
            key={e.slug}
            role="tab"
            aria-selected={activeEnv === e.slug}
            data-env={e.slug}
            className="env-chip"
            onClick={() => onChangeEnv(e.slug)}
            title={`/${e.slug}`}
          >
            <span className="dot" />
            {e.name}
          </button>
        ))}
      </div>

      {/* spacer to push everything else to the right */}
      <div style={{ flex: 1 }} />

      <GlobalSearch />

      <Tip tip="Keyboard shortcuts (?)" position="bottom">
        <button className="icon-btn" onClick={onShowHelp} aria-label="Keyboard shortcuts">
          <Icon name="keyboard" size={16} />
        </button>
      </Tip>

      <button className="icon-btn" onClick={handleToggleTheme} aria-label="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>

      {user && (
        <span className="key-indicator" title={user.email}>
          <span className="dot" />
          <span>{user.name}</span>
          <span className="muted">· {user.role}</span>
        </span>
      )}
    </header>
  )
}
