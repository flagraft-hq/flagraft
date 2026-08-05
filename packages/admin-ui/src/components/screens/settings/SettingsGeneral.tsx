import { useState } from 'react'

import { projectsApi, ApiError } from '../../../lib/api'
import { useProject } from '../../../contexts/ProjectContext'
import { useToast } from '../../../hooks/useToast'
import { usePermissions } from '../../../hooks/usePermissions'
import { Button } from '../../primitives/Button'
import { Denied } from '../../primitives/Denied'
import { FormError } from '../../primitives/FormError'
import { TextField } from '../../primitives/TextField'
import { CopyButton } from '../../primitives/CopyButton'
import { SettingsCard, SettingsRow } from './SettingsCard'

/**
 * General project settings — name, description, project details, and danger zone.
 */
export function SettingsGeneral() {
  const { activeProject, setActiveProject, environments } = useProject()
  const toast = useToast()
  const { canProjectAdmin } = usePermissions()

  const [name, setName] = useState(activeProject?.name ?? '')
  const [description, setDescription] = useState(activeProject?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activeProject) return null

  const dirty =
    name.trim() !== activeProject.name || description !== (activeProject.description ?? '')

  function discard() {
    if (!activeProject) return
    setName(activeProject.name)
    setDescription(activeProject.description ?? '')
    setError(null)
  }

  async function save() {
    if (!activeProject || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const res = await projectsApi.update(activeProject.id, {
        name: name.trim(),
        description,
      })
      setActiveProject(res.data)
      toast.push({ title: 'Settings saved', variant: 'success' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section-stack">
      <SettingsCard
        title="Identity"
        sub="Shown in the project switcher, navigation, and SDK keys."
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" disabled={!dirty || saving} onClick={discard}>
              Discard
            </Button>
            <Denied
              when={!canProjectAdmin}
              reason="Only owners and admins can edit project settings"
            >
              <Button
                variant="primary"
                disabled={!dirty || saving || !canProjectAdmin}
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </Denied>
          </>
        }
      >
        <FormError message={error} />
        <SettingsRow
          label="Display name"
          hint="Up to 64 characters. Use the team's name for it, not the codename."
        >
          <TextField value={name} onChange={setName} maxLength={64} placeholder="Project name" />
        </SettingsRow>
        <SettingsRow
          label="Description"
          hint="Optional context shown on the project switcher tooltip."
          full
        >
          <textarea
            className="settings-textarea"
            rows={3}
            value={description}
            placeholder="What this project owns."
            onChange={(e) => setDescription(e.target.value)}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Project details"
        sub="Identifiers and environment information for SDK integration and API access."
      >
        <SettingsRow label="Project slug" hint="Unique key used in URLs and SDK configuration.">
          <div className="settings-copy-row">
            <span className="mono-val">{activeProject.slug}</span>
            <CopyButton value={activeProject.slug} ariaLabel="Copy project slug" />
          </div>
        </SettingsRow>
        <SettingsRow label="Project ID" hint="Unique UUID for this project resource.">
          <div className="settings-copy-row">
            <span className="mono-val">{activeProject.id}</span>
            <CopyButton value={activeProject.id} ariaLabel="Copy project ID" />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Configured environments"
          hint="Environments configured under this project."
        >
          <div className="settings-env-chips">
            {environments.map((env) => (
              <span key={env.id} className="env-chip-badge">
                <span className="dot" />
                {env.name} ({env.slug})
              </span>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Danger zone"
        sub="Irreversible actions for this project."
        className="danger-card"
      >
        <div className="danger-zone-content">
          <div className="danger-zone-info">
            <div className="lbl">Delete project</div>
            <div className="hint">
              Permanently remove this project, all flag evaluation rules, environments, and API
              keys. This action cannot be undone.
            </div>
          </div>
          <Button variant="danger" disabled>
            Delete project
          </Button>
        </div>
      </SettingsCard>
    </div>
  )
}
