import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'
import { Kbd } from '../primitives/Kbd'
import { useTheme } from '../../contexts/ThemeContext'

export type EnvSlug = 'development' | 'staging' | 'production'

export interface ProjectInfo {
  id: string
  name: string
  slug: string
}

export interface TopBarProps {
  project: ProjectInfo
  onSwitchProject: () => void
  activeEnv: EnvSlug
  onChangeEnv: (env: EnvSlug) => void
  onOpenSearch: () => void
  onShowHelp: () => void
}

const ENVS: Array<{ slug: EnvSlug; name: string }> = [
  { slug: 'development', name: 'Development' },
  { slug: 'staging', name: 'Staging' },
  { slug: 'production', name: 'Production' },
]

export function TopBar({
  project,
  onSwitchProject,
  activeEnv,
  onChangeEnv,
  onOpenSearch,
  onShowHelp,
}: TopBarProps) {
  const { theme, setTheme } = useTheme()

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
        {ENVS.map((e) => (
          <button
            key={e.slug}
            role="tab"
            aria-selected={activeEnv === e.slug}
            data-env={e.slug}
            className="env-chip"
            onClick={() => onChangeEnv(e.slug)}
          >
            <span className="dot" />
            {e.name}
          </button>
        ))}
      </div>

      {/* Search (read-only, triggers command palette) */}
      <div className="topbar-search">
        <Icon name="search" size={14} className="search-icon" />
        <input
          placeholder="Search flags, overrides, keys..."
          readOnly
          onFocus={onOpenSearch}
          aria-label="Search"
        />
        <span className="kbd-hint">
          <Kbd keys={['Cmd', 'K']} />
        </span>
      </div>

      {/* Right panel */}
      <div className="topbar-right">
        <span className="key-indicator">
          <span className="dot" />
          <span>ff_ad_a91c</span>
          <span className="muted">- admin</span>
        </span>
        <Tip tip="Keyboard shortcuts (?)">
          <button className="icon-btn" onClick={onShowHelp} aria-label="Keyboard shortcuts">
            <Icon name="keyboard" size={16} />
          </button>
        </Tip>
        <button className="icon-btn" onClick={handleToggleTheme} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  )
}
