import { eq, getTableColumns } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, projects, userProjects } from '../../db/schema.js'
import type { KeyContext } from '../../plugins/auth.js'
import { AppError } from '../../plugins/errorHandler.js'
import { DEFAULT_ENVIRONMENTS } from '../../constants/environments.js'
import type { CreateProjectInput, PatchProjectInput } from './project.schema.js'

/**
 * Creates a new project and initializes it with default environments
 */
export async function createProject(db: Db, input: CreateProjectInput) {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(input).returning()
    await tx.insert(environments).values(
      DEFAULT_ENVIRONMENTS.map((environment) => ({
        ...environment,
        projectId: project.id,
      })),
    )
    return project
  })
}

/**
 * Lists projects visible to the given security context
 */
export async function listProjects(db: Db, context: KeyContext) {
  if (context.isRoot) {
    return db.select().from(projects).orderBy(projects.createdAt)
  }

  /** Browser session with a non-admin role: list the projects they are members of. */
  if (context.userId) {
    return db
      .select(getTableColumns(projects))
      .from(projects)
      .innerJoin(userProjects, eq(userProjects.projectId, projects.id))
      .where(eq(userProjects.userId, context.userId))
      .orderBy(projects.createdAt)
  }

  if (!context.projectId) {
    return []
  }

  return db.select().from(projects).where(eq(projects.id, context.projectId))
}

/**
 * Retrieves a single project by its ID
 */
export async function getProject(db: Db, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project) {
    throw new AppError('Project not found', 404, 'NotFound')
  }
  return project
}

/**
 * Updates an existing project's details
 */
export async function patchProject(db: Db, projectId: string, input: PatchProjectInput) {
  const { settings, ...rest } = input

  return db.transaction(async (tx) => {
    /**
     * Settings is a bag of groups. Merge one level deep so updating one group
     * (e.g. flagDefaults) leaves the others untouched, rather than replacing
     * the whole object.
     */
    let mergedSettings
    if (settings) {
      const [current] = await tx
        .select({ settings: projects.settings })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)
      if (!current) {
        throw new AppError('Project not found', 404, 'NotFound')
      }
      mergedSettings = { ...current.settings, ...settings }
    }

    const [project] = await tx
      .update(projects)
      .set({ ...rest, ...(mergedSettings ? { settings: mergedSettings } : {}), updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning()

    if (!project) {
      throw new AppError('Project not found', 404, 'NotFound')
    }

    return project
  })
}

/**
 * Deletes a project
 */
export async function deleteProject(db: Db, projectId: string) {
  const [project] = await db.delete(projects).where(eq(projects.id, projectId)).returning()
  if (!project) {
    throw new AppError('Project not found', 404, 'NotFound')
  }
}
