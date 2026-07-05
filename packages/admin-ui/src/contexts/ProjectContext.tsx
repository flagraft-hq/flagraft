import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { projectsApi, environmentsApi } from '../lib/api'
import type { Project, Env } from '../lib/types'
import { useAuth } from './AuthContext'

/** Environment slugs are project-defined, so this is just a string. */
export type EnvSlug = string

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProject: (project: Project) => void
  /** Environments for the active project — the single source of truth for env names/scope. */
  environments: Env[]
  refetchEnvironments: () => void
  activeEnv: EnvSlug
  setActiveEnv: (env: EnvSlug) => void
  loading: boolean
  error: string | null
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [environments, setEnvironments] = useState<Env[]>([])
  const [activeEnv, setActiveEnv] = useState<EnvSlug>('development')
  const [envTick, setEnvTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const refetchEnvironments = useCallback(() => setEnvTick((t) => t + 1), [])

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

  /** Load the active project's environments — the source the whole app reads names from. */
  useEffect(() => {
    if (!activeProject) {
      setEnvironments([])
      return
    }
    let cancelled = false
    environmentsApi
      .list(activeProject.id)
      .then((res) => {
        if (cancelled) return
        setEnvironments(res.data)
        // Keep the active env scope valid for the current project.
        setActiveEnv((current) =>
          res.data.some((e) => e.slug === current) ? current : (res.data[0]?.slug ?? current),
        )
      })
      .catch(() => {
        if (!cancelled) setEnvironments([])
      })
    return () => {
      cancelled = true
    }
  }, [activeProject?.id, envTick])

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        setActiveProject,
        environments,
        refetchEnvironments,
        activeEnv,
        setActiveEnv,
        loading,
        error,
      }}
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
