import { useState } from 'react'

import { useProject } from '../../contexts/ProjectContext'
import { Icon, type IconName } from '../primitives/Icon'
import { ContextFieldsSection } from './ContextFieldsSection'
import { SettingsGeneral } from './settings/SettingsGeneral'
import { SettingsDefaults } from './settings/SettingsDefaults'
import { SettingsSecurity } from './settings/SettingsSecurity'
import { SettingsMembers } from './settings/SettingsMembers'

type SectionId = 'general' | 'defaults' | 'context' | 'security' | 'members'

const TABS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'defaults', label: 'Flag defaults', icon: 'flag' },
  { id: 'context', label: 'Context fields', icon: 'target' },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'members', label: 'Members & roles', icon: 'user' },
]

export function SettingsScreen() {
  const { activeProject } = useProject()
  const [section, setSection] = useState<SectionId>('general')

  if (!activeProject) {
    return <div className="settings-no-project">No project selected</div>
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1 className="settings-page-title">Project settings</h1>
        <div className="settings-page-sub">
          Configure how <span className="mono">{activeProject.slug}</span> behaves — defaults, access,
          and the context schema. Settings apply across all environments unless noted.
        </div>
      </header>

      <nav className="settings-tabs" role="tablist" aria-label="Project settings tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="settings-tab"
            role="tab"
            aria-selected={section === t.id}
            onClick={() => setSection(t.id)}
          >
            <Icon name={t.icon} size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="settings-content">
        {section === 'general' && <SettingsGeneral />}
        {section === 'defaults' && <SettingsDefaults />}
        {section === 'context' && <ContextFieldsSection projectId={activeProject.id} />}
        {section === 'security' && <SettingsSecurity />}
        {section === 'members' && <SettingsMembers />}
      </main>
    </div>
  )
}
