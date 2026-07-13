import argon2 from 'argon2'
import { eq } from 'drizzle-orm'

import { DEFAULT_USER_ROLE } from '../../auth/constants.js'
import type { Db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import type { User } from '../../db/schema.js'

/**
 * Precomputed dummy hash used to prevent email enumeration via timing analysis.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}

export async function getUserByEmail(db: Db, email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1)
  return user
}

export async function getUserById(db: Db, id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user
}

export async function createUser(
  db: Db,
  data: { email: string; password: string; name: string; role?: string; status?: string },
): Promise<User> {
  const passwordHash = await hashPassword(data.password)
  const initials = data.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name,
      /** Least privilege: callers that omit a role get the read-only one. */
      role: data.role ?? DEFAULT_USER_ROLE,
      status: data.status ?? 'active',
      initials,
    })
    .returning()
  return user
}

/**
 * Returns the user if credentials are valid and the account is active.
 * Returns 'suspended' when the password is correct but the account is
 * suspended — safe to reveal, since only the account holder can prove the
 * password; wrong-password attempts on suspended accounts still get null.
 * Always runs argon2.verify even if the user is not found to prevent
 * timing-based email enumeration.
 */
export async function validateCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<User | 'suspended' | null> {
  const user = await getUserByEmail(db, email)
  const hash = user?.passwordHash ?? DUMMY_HASH
  const valid = await argon2.verify(hash, password)
  if (!user || !valid) return null
  if (user.status === 'suspended') return 'suspended'
  return user.status === 'active' ? user : null
}
