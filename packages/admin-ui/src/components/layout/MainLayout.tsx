import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { SideNav } from './SideNav'
import { ShortcutsHelpModal } from './ShortcutsHelpModal'
import { ProjectSwitcherModal } from './ProjectSwitcherModal'
import { useProject } from '../../contexts/ProjectContext'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import type { EnvSlug } from './TopBar'
import type { NavItemId } from './SideNav'

export interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { activeProject, activeEnv, setActiveEnv } = useProject()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)

  const current = (pathname.split('/')[1] || 'flags') as NavItemId

  function focusSearch() {
    const input = document.querySelector<HTMLInputElement>('.topbar-search input')
    input?.focus()
  }

  useKeyboardShortcuts({
    '/': focusSearch,
    'cmd+k': focusSearch,
    '?': () => setShowShortcuts(true),
    Escape: () => {
      if (showShortcuts) setShowShortcuts(false)
    },
  })

  const project = activeProject ?? { id: '', name: 'No project', slug: '' }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="app-shell">
        <TopBar
          project={project}
          onSwitchProject={() => setShowSwitcher(true)}
          activeEnv={(activeEnv as EnvSlug) ?? 'development'}
          onChangeEnv={setActiveEnv}
          onOpenSearch={focusSearch}
          onShowHelp={() => setShowShortcuts(true)}
        />
        <SideNav current={current} onNav={(id) => navigate(`/${id}`)} />
        <main className="main" id="main-content">{children}</main>
      </div>
      <ShortcutsHelpModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ProjectSwitcherModal open={showSwitcher} onClose={() => setShowSwitcher(false)} />
    </>
  )
}
