import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { SideNav } from './SideNav'
import { ShortcutsHelpModal } from './ShortcutsHelpModal'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import type { EnvSlug, ProjectInfo } from './TopBar'
import type { NavItemId } from './SideNav'

const PLACEHOLDER_PROJECT: ProjectInfo = {
  id: 'proj-1',
  name: 'Flagraft Demo',
  slug: 'flagraft-demo',
}

export interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [activeEnv, setActiveEnv] = useState<EnvSlug>('development')
  const [showShortcuts, setShowShortcuts] = useState(false)

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

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        <TopBar
          project={PLACEHOLDER_PROJECT}
          onSwitchProject={() => {}}
          activeEnv={activeEnv}
          onChangeEnv={setActiveEnv}
          onOpenSearch={focusSearch}
          onShowHelp={() => setShowShortcuts(true)}
        />
        <SideNav current={current} onNav={(id) => navigate(`/${id}`)} />
        <main className="main" id="main-content">
          {children}
        </main>
      </div>
      <ShortcutsHelpModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </>
  )
}
