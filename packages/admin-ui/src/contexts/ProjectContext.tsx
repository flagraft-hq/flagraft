import React, { createContext, useState, useEffect, ReactNode } from 'react'
import { projectsApi } from '../lib/api'
import type { Project } from '../lib/types'
import { useAuth } from './AuthContext'

export type EnvSlug = 'development' | 'production'

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProject: (project: Project) => void
  activeEnv: EnvSlug
  setActiveEnv: (env: EnvSlug) => void
  loading: boolean
  error: string | null
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [activeEnv, setActiveEnv] = useState<EnvSlug>('development')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setProjects([])
      setActiveProject(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    projectsApi
      .list()
      .then((res) => {
        if (cancelled) return
        setProjects(res.data)
        if (res.data.length > 0) setActiveProject(res.data[0])
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <ProjectContext.Provider
      value={{ projects, activeProject, setActiveProject, activeEnv, setActiveEnv, loading, error }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = React.useContext(ProjectContext)
  if (!ctx) throw new Error('useProject called outside ProjectProvider')
  return ctx
}
