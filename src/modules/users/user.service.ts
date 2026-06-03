import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { users, userProjects, projects } from '../../db/schema.js'
import type { User } from '../../db/schema.js'
import { createUser, hashPassword } from '../auth/auth.service.js'

export async function listUsers(db: Db) {
  const rows = await db
    .select({
      user: users,
      projectId: userProjects.projectId,
      projectName: projects.name,
    })
    .from(users)
    .leftJoin(userProjects, eq(userProjects.userId, users.id))
    .leftJoin(projects, eq(projects.id, userProjects.projectId))

  const map = new Map<string, User & { projects: string[] }>()
  for (const row of rows) {
    if (!map.has(row.user.id)) {
      map.set(row.user.id, { ...row.user, projects: [] })
    }
    if (row.projectName) map.get(row.user.id)!.projects.push(row.projectName)
  }
  return Array.from(map.values())
}

export async function getUserWithProjects(db: Db, id: string) {
  const rows = await db
    .select({ user: users, projectId: userProjects.projectId, projectName: projects.name })
    .from(users)
    .where(eq(users.id, id))
    .leftJoin(userProjects, eq(userProjects.userId, users.id))
    .leftJoin(projects, eq(projects.id, userProjects.projectId))
  if (!rows.length) return undefined
  const user = rows[0].user
  const userProj = rows
    .filter((r) => r.projectName)
    .map((r) => ({ id: r.projectId!, name: r.projectName! }))
  return { ...user, projects: userProj }
}

/**
 * Creates an invited user with a generated temp password.
 * Returns the user record along with the plaintext tempPassword so the
 * admin can share it manually -- no email is sent.
 */
export async function inviteUser(
  db: Db,
  data: { email: string; role: string; projectIds: string[] },
): Promise<{ user: User; tempPassword: string }> {
  const tempPassword = randomBytes(10).toString('base64url')
  const name = data.email.split('@')[0]
  const user = await createUser(db, {
    email: data.email,
    password: tempPassword,
    name,
    role: data.role,
    status: 'invited',
  })
  if (data.projectIds.length > 0) {
    await db
      .insert(userProjects)
      .values(data.projectIds.map((projectId) => ({ userId: user.id, projectId })))
  }
  return { user, tempPassword }
}

export async function patchUser(
  db: Db,
  id: string,
  data: { role?: string; status?: string; name?: string },
): Promise<User> {
  const updates: Record<string, unknown> = {}
  if (data.role) updates.role = data.role
  if (data.status) updates.status = data.status
  if (data.name) {
    updates.name = data.name
    updates.initials = data.name
      .split(' ')
      .filter(Boolean)
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return updated
}

/**
 * Generates a new temp password, hashes it, and stores it.
 * Returns the plaintext password so the admin can share it manually.
 */
export async function resetPassword(db: Db, id: string): Promise<string> {
  const tempPassword = randomBytes(10).toString('base64url')
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword) })
    .where(eq(users.id, id))
  return tempPassword
}

export async function deleteUser(db: Db, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

export async function addUserToProject(db: Db, userId: string, projectId: string): Promise<void> {
  await db.insert(userProjects).values({ userId, projectId }).onConflictDoNothing()
}

/**
 * Removes a specific user from a specific project by matching both
 * userId and projectId so only the intended row is deleted.
 */
export async function removeUserFromProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<void> {
  await db
    .delete(userProjects)
    .where(and(eq(userProjects.userId, userId), eq(userProjects.projectId, projectId)))
}
