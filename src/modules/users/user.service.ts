import { createHash, randomBytes } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { users, userProjects, projects } from '../../db/schema.js'
import type { User } from '../../db/schema.js'
import { createUser, hashPassword } from '../auth/auth.service.js'

/** Invite links live for 24 hours. */
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

/** Tokens are stored hashed so a database leak cannot yield usable invite links. */
function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Strips credential and invite-token material from a user record before it
 * leaves the API. Every route that returns users must go through this.
 */
export function toPublicUser(user: User) {
  const { passwordHash, inviteTokenHash, inviteExpiresAt, sessionVersion, ...safe } = user
  void passwordHash
  void inviteTokenHash
  void inviteExpiresAt
  void sessionVersion
  return safe
}

export type PublicUser = ReturnType<typeof toPublicUser>

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

  const map = new Map<string, PublicUser & { projects: string[] }>()
  for (const row of rows) {
    if (!map.has(row.user.id)) {
      map.set(row.user.id, { ...toPublicUser(row.user), projects: [] })
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
  return { ...toPublicUser(user), projects: userProj }
}

/**
 * Creates an invited user and issues a one-time invite token (valid 24h).
 * The account has an unusable random password and status 'invited', so it
 * cannot be logged into until the invite is accepted. Returns the plaintext
 * token so the caller can build a link to email or share manually.
 */
export async function inviteUser(
  db: Db,
  data: { email: string; role: string; projectIds: string[] },
): Promise<{ user: User; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const name = data.email.split('@')[0]
  const user = await createUser(db, {
    /** Unusable placeholder; the real password is set when the invite is accepted. */
    password: randomBytes(32).toString('base64url'),
    email: data.email,
    name,
    role: data.role,
    status: 'invited',
  })
  await db
    .update(users)
    .set({ inviteTokenHash: hashInviteToken(token), inviteExpiresAt: expiresAt })
    .where(eq(users.id, user.id))
  if (data.projectIds.length > 0) {
    await db
      .insert(userProjects)
      .values(data.projectIds.map((projectId) => ({ userId: user.id, projectId })))
  }
  return { user, token, expiresAt }
}

/**
 * Re-issues the invite for a still-invited user: a fresh token and a fresh
 * 24h expiry. The old link stops working because the stored hash is replaced.
 * Returns undefined when the user does not exist or is not in invited status.
 */
export async function reissueInvite(
  db: Db,
  id: string,
): Promise<{ user: User; token: string; expiresAt: Date } | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user || user.status !== 'invited') return undefined
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  await db
    .update(users)
    .set({
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
  return { user, token, expiresAt }
}

/**
 * Looks up a pending invite by its plaintext token. Returns the invited user
 * only when the token matches and has not expired; otherwise undefined.
 */
export async function getUserByInviteToken(db: Db, token: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.inviteTokenHash, hashInviteToken(token)))
    .limit(1)
  if (!user || !user.inviteExpiresAt) return undefined
  if (user.inviteExpiresAt.getTime() < Date.now()) return undefined
  return user
}

/**
 * Accepts a pending invite: sets the chosen password, activates the account,
 * and clears the token so the link cannot be reused. Returns the activated
 * user, or undefined if the token is invalid or expired.
 */
export async function acceptInvite(
  db: Db,
  token: string,
  password: string,
): Promise<User | undefined> {
  const user = await getUserByInviteToken(db, token)
  if (!user) return undefined
  const [updated] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      status: 'active',
      inviteTokenHash: null,
      inviteExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning()
  return updated
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
 * Sets the admin-chosen password and bumps sessionVersion so every existing
 * session is invalidated. Invited accounts are activated and their pending
 * invite link voided, because login requires status 'active' — without this
 * the new password could never be used. Returns the updated user, or
 * undefined when no user has that id.
 */
export async function resetPassword(
  db: Db,
  id: string,
  password: string,
): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return undefined
  const [updated] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
      ...(user.status === 'invited'
        ? { status: 'active', inviteTokenHash: null, inviteExpiresAt: null }
        : {}),
    })
    .where(eq(users.id, id))
    .returning()
  return updated
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
