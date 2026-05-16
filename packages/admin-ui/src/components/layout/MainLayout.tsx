import { useState } from 'react'
import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { SideNav } from './SideNav'
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
  const [current, setCurrent] = useState<NavItemId>('flags')
  const [activeEnv, setActiveEnv] = useState<EnvSlug>('development')

  return (
    <div className="app-shell">
      <TopBar
        project={PLACEHOLDER_PROJECT}
        onSwitchProject={() => {}}
        activeEnv={activeEnv}
        onChangeEnv={setActiveEnv}
        onOpenSearch={() => {}}
        onShowHelp={() => {}}
      />
      <SideNav current={current} onNav={setCurrent} />
      <main className="main">{children}</main>
    </div>
  )
}
