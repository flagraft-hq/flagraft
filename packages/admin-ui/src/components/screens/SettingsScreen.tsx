import { useProject } from '../../contexts/ProjectContext'
import { Tip } from '../primitives/Tip'
import { Button } from '../primitives/Button'
import { ContextFieldsSection } from './ContextFieldsSection'

const ENVIRONMENTS = ['development', 'production'] as const

export function SettingsScreen() {
  const { activeProject } = useProject()

  if (!activeProject) {
    return <div className="settings-no-project">No project selected</div>
  }

  return (
    <div className="settings-screen">
      <h1 className="settings-title">Project Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">Project</h2>
        <div className="settings-field">
          <span className="settings-field-label">Name</span>
          <span className="settings-field-value">{activeProject.name}</span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">Slug</span>
          <span className="settings-field-value mono">{activeProject.slug}</span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">Project ID</span>
          <span className="settings-field-value mono">{activeProject.id}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Environments</h2>
        <div className="settings-envs">
          {ENVIRONMENTS.map((env) => (
            <div key={env} className="settings-env-chip">
              {env}
            </div>
          ))}
        </div>
      </section>

      <ContextFieldsSection projectId={activeProject.id} />

      <section className="settings-section settings-danger-zone">
        <h2 className="settings-section-title">Danger Zone</h2>
        <p className="settings-danger-desc">
          Deleting a project is permanent and cannot be undone. Use the CLI to delete a project.
        </p>
        <Tip tip="Project deletion requires CLI access">
          <Button variant="danger" disabled>
            Delete project
          </Button>
        </Tip>
      </section>
    </div>
  )
}
