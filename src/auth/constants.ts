export const API_KEY_TYPES = {
  ADMIN: 'admin',
  CLIENT: 'client',
} as const

export type ApiKeyType = (typeof API_KEY_TYPES)[keyof typeof API_KEY_TYPES]

/**
 * Single source of truth for user roles. ES modules are evaluated once, so
 * these frozen objects act as singletons -- every importer shares them.
 */
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

/** Roles allowed to administer the whole workspace (users, keys, projects). */
export const WORKSPACE_ADMIN_ROLES: ReadonlySet<string> = new Set([
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
])

/** Roles that may only read, never mutate. */
export const READ_ONLY_ROLES: ReadonlySet<string> = new Set([USER_ROLES.VIEWER])
