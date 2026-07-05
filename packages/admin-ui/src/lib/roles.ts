/**
 * Single source of truth for user roles on the frontend.
 * Mirrors src/auth/constants.ts on the backend -- keep the two in sync.
 */
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

/** Roles that can be granted via invite; ownership can never be invited. */
export const INVITABLE_ROLES = [USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.VIEWER] as const

export type InvitableRole = (typeof INVITABLE_ROLES)[number]

/** Pre-selected role for new invites -- least privilege. */
export const DEFAULT_INVITE_ROLE: InvitableRole = USER_ROLES.VIEWER
