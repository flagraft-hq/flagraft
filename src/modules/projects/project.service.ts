import { eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { environments, projects } from '../../db/schema.js'
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
  const [project] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning()

  if (!project) {
    throw new AppError('Project not found', 404, 'NotFound')
  }

  return project
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
