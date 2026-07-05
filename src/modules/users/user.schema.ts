import { z } from 'zod'

import { DEFAULT_USER_ROLE, USER_ROLES } from '../../auth/constants.js'

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

export const patchUserSchema = z
  .object({
    role: z
      .enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.VIEWER])
      .optional(),
    status: z.enum(['active', 'suspended']).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((v) => Object.values(v).some((val) => val !== undefined), 'At least one field required')
