import { useState } from 'react'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { useProject } from '../../contexts/ProjectContext'
import { CreateProjectModal } from './CreateProjectModal'
import type { Project } from '../../lib/types'

export interface ProjectSwitcherModalProps {
  open: boolean
  onClose: () => void
}

export function ProjectSwitcherModal({ open, onClose }: ProjectSwitcherModalProps) {
  const { projects, activeProject, setActiveProject } = useProject()
  const [showCreate, setShowCreate] = useState(false)

  function handleSelect(project: Project) {
    setActiveProject(project)
    onClose()
  }

  function handleCreated(project: Project) {
    setActiveProject(project)
    setShowCreate(false)
    onClose()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} titleId="switcher-modal-title">
        <Modal.Header id="switcher-modal-title">Switch project</Modal.Header>
        <Modal.Body>
          {projects.length === 0 ? (
            <p className="project-list-empty">No projects found.</p>
          ) : (
            <ul className="project-list" role="list">
              {projects.map((project) => {
                const isActive = project.id === activeProject?.id
                return (
                  <li key={project.id}>
                    <button
                      className={`project-list-item${isActive ? ' project-list-item--active' : ''}`}
                      onClick={() => handleSelect(project)}
                    >
                      <span className="project-list-name">{project.name}</span>
                      <span className="project-list-slug">{project.slug}</span>
                      {isActive && <Icon name="check" size={16} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowCreate(true)}>
            + New project
          </Button>
        </Modal.Footer>
      </Modal>
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </>
  )
}
