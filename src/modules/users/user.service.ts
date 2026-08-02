import { createHash, randomBytes } from 'node:crypto'
import { and, asc, desc, eq, exists, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import type { Db } from '../../db/index.js'
import { users, userProjects, projects } from '../../db/schema.js'
import type { User } from '../../db/schema.js'
import { createUser, hashPassword } from '../auth/auth.service.js'
import type { ListUsersQuery } from './user.schema.js'

/** Invite links live for 24 hours. */
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Minimum time between invite emails to the same user, so resend cannot be
 * used to spam an invitee's inbox.
 */
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000

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

/**
 * Escapes the LIKE wildcards in user input so a search for "50%" looks for a
 * literal percent sign instead of matching everything.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/** Number of projects a user belongs to, for the "Projects" sort column. */
const projectCount = sql<number>`(
  select count(*) from ${userProjects} where ${userProjects.userId} = ${users.id}
)`

/** Roles are ranked by privilege, not alphabetically. */
const roleRank = sql<number>`case ${users.role}
  when 'owner' then 0 when 'admin' then 1 when 'editor' then 2 else 3 end`

/**
 * Counts every bucket the Users screen displays, across the whole workspace
 * and independent of the caller's filters. Service accounts are counted as
 * such rather than by lifecycle status, matching what the chips show.
 */
export async function countUsers(db: Db) {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      system: sql<number>`count(*) filter (where ${users.isSystem})::int`,
      active: sql<number>`count(*) filter (where not ${users.isSystem} and ${users.status} = 'active')::int`,
      invited: sql<number>`count(*) filter (where not ${users.isSystem} and ${users.status} = 'invited')::int`,
      suspended: sql<number>`count(*) filter (where not ${users.isSystem} and ${users.status} = 'suspended')::int`,
      owners: sql<number>`count(*) filter (where ${users.role} = 'owner')::int`,
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
    })
    .from(users)

  return row ?? { all: 0, system: 0, active: 0, invited: 0, suspended: 0, owners: 0, admins: 0 }
}

/**
 * Lists one page of workspace users with their project names, filtered and
 * sorted in the database. Returns the page, the total number of matching
 * rows, and workspace-wide counts for the status chips.
 */
export async function listUsers(db: Db, query: ListUsersQuery) {
  const filters = []

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`
    filters.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(userProjects)
            .innerJoin(projects, eq(projects.id, userProjects.projectId))
            .where(and(eq(userProjects.userId, users.id), ilike(projects.name, pattern))),
        ),
      )!,
    )
  }

  if (query.status === 'system') {
    filters.push(eq(users.isSystem, true))
  } else if (query.status) {
    /** Service accounts are their own bucket, so exclude them from the others. */
    filters.push(and(eq(users.isSystem, false), eq(users.status, query.status))!)
  }

  if (query.role) filters.push(eq(users.role, query.role))

  if (query.projectId) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(userProjects)
          .where(
            and(eq(userProjects.userId, users.id), eq(userProjects.projectId, query.projectId)),
          ),
      ),
    )
  }

  const where = filters.length ? and(...filters) : undefined

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(where)
  const total = totals?.total ?? 0

  const direction = query.dir === 'asc' ? asc : desc
  const sortExpression = {
    name: users.name,
    role: roleRank,
    projects: projectCount,
    last: users.lastLoginAt,
  }[query.sort]

  const page = await db
    .select()
    .from(users)
    .where(where)
    /** Email breaks ties so paging never repeats or skips a row. */
    .orderBy(direction(sortExpression), asc(users.email))
    .limit(query.limit)
    .offset(query.offset)

  const data: (PublicUser & { projects: string[] })[] = page.map((user) => ({
    ...toPublicUser(user),
    projects: [],
  }))

  /** One follow-up query attaches project names to just this page. */
  if (data.length > 0) {
    const byId = new Map(data.map((u) => [u.id, u]))
    const memberships = await db
      .select({ userId: userProjects.userId, projectName: projects.name })
      .from(userProjects)
      .innerJoin(projects, eq(projects.id, userProjects.projectId))
      .where(inArray(userProjects.userId, [...byId.keys()]))
      .orderBy(asc(projects.name))

    for (const row of memberships) {
      byId.get(row.userId)?.projects.push(row.projectName)
    }
  }

  return {
    data,
    total,
    limit: query.limit,
    offset: query.offset,
    counts: await countUsers(db),
  }
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
 * Returns undefined when the user does not exist or is not in invited status,
 * and 'cooldown' when the current invite was issued too recently.
 *
 * Status and cooldown live in the UPDATE's WHERE clause, so concurrent
 * resends serialize on the row lock and exactly one can rotate the token
 * per cooldown window, no check-then-update race.
 */
export async function reissueInvite(
  db: Db,
  id: string,
): Promise<{ user: User; token: string; expiresAt: Date } | 'cooldown' | undefined> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  /**
   * The issue time is not stored, but expiry is always issue time + TTL, so
   * "issued less than COOLDOWN ago" is "expiry after now + TTL - COOLDOWN".
   */
  const cooldownThreshold = new Date(Date.now() + INVITE_TTL_MS - RESEND_COOLDOWN_MS)
  const [updated] = await db
    .update(users)
    .set({
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, id),
        eq(users.status, 'invited'),
        or(isNull(users.inviteExpiresAt), lt(users.inviteExpiresAt, cooldownThreshold)),
      ),
    )
    .returning()
  if (updated) return { user: updated, token, expiresAt }

  /** Zero rows: read once to tell "no pending invite" apart from cooldown. */
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user || user.status !== 'invited') return undefined
  return 'cooldown'
}

/**
 * Cancels a pending invite by deleting the invited account. The delete is
 * conditional on status = 'invited' in one statement, so a stale click can
 * never remove an account that was activated in the meantime.
 */
export async function cancelInvite(
  db: Db,
  id: string,
): Promise<'canceled' | 'already_active' | 'not_found'> {
  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.status, 'invited')))
    .returning()
  if (deleted) return 'canceled'
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ? 'already_active' : 'not_found'
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
