import { z } from 'zod'

import { DEFAULT_USER_ROLE, USER_ROLES } from '../../auth/constants.js'

/** Hard ceiling on page size so a caller cannot ask for the whole table. */
export const MAX_PAGE_SIZE = 100

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  /** Matched against name, email and project name. */
  search: z.string().trim().min(1).optional(),
  /** 'system' selects service accounts rather than a lifecycle status. */
  status: z.enum(['active', 'invited', 'suspended', 'system']).optional(),
  role: z
    .enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.VIEWER])
    .optional(),
  /** Restricts the list to members of one project. */
  projectId: z.string().uuid().optional(),
  sort: z.enum(['name', 'role', 'projects', 'last']).default('name'),
  dir: z.enum(['asc', 'desc']).default('asc'),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const inviteUserSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  /**
   * Owner is excluded on purpose: invites can never grant ownership.
   * An omitted role defaults to viewer -- least privilege.
   */
  role: z.enum([USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.VIEWER]).default(DEFAULT_USER_ROLE),
  projectIds: z.array(z.string().uuid()).default([]),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/** Admin-chosen replacement password; same rule as invite acceptance. */
export const resetPasswordSchema = acceptInviteSchema

export const patchUserSchema = z
  .object({
    role: z
      .enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.VIEWER])
      .optional(),
    status: z.enum(['active', 'suspended']).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((v) => Object.values(v).some((val) => val !== undefined), 'At least one field required')
