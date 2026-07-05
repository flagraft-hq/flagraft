import { z } from 'zod'

export const inviteUserSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
  projectIds: z.array(z.string().uuid()).default([]),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const patchUserSchema = z
  .object({
    role: z.enum(['owner', 'admin', 'editor', 'viewer']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((v) => Object.values(v).some((val) => val !== undefined), 'At least one field required')
