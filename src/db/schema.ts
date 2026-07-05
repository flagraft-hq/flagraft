import { API_KEY_TYPES } from '../auth/constants'
import { relations, sql } from 'drizzle-orm'
import { boolean, check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const projects = pgTable('projects', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const environments = pgTable(
  'environments',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    protected: boolean('protected').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [unique('environments_project_id_slug_unique').on(table.projectId, table.slug)],
)

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique('feature_flags_project_id_key_unique').on(table.projectId, table.key)],
)

export const flagEnvironments = pgTable(
  'flag_environments',
  {
    id: id(),
    flagId: uuid('flag_id')
      .notNull()
      .references(() => featureFlags.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('flag_environments_flag_id_environment_id_unique').on(table.flagId, table.environmentId),
  ],
)

export const flagOverrides = pgTable(
  'flag_overrides',
  {
    id: id(),
    flagId: uuid('flag_id')
      .notNull()
      .references(() => featureFlags.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    contextKey: text('context_key').notNull(),
    contextValue: text('context_value').notNull(),
    enabled: boolean('enabled').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique('flag_overrides_tuple_unique').on(
      table.flagId,
      table.environmentId,
      table.contextKey,
      table.contextValue,
    ),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').references(() => environments.id, {
      onDelete: 'cascade',
    }),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    type: text('type').notNull(),
    description: text('description'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  () => [
    check(
      'api_keys_type_check',
      sql.raw(`"type" IN ('${API_KEY_TYPES.CLIENT}', '${API_KEY_TYPES.ADMIN}')`),
    ),
  ],
)

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('editor'),
  status: text('status').notNull().default('active'),
  twoFa: text('two_fa').notNull().default('none'),
  isSystem: boolean('is_system').notNull().default(false),
  initials: text('initials').notNull().default(''),
  tone: text('tone').notNull().default('teal'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  /** SHA-256 of the pending invite token; null once the invite is accepted or never issued. */
  inviteTokenHash: text('invite_token_hash'),
  /** When the pending invite link stops working. */
  inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const userProjects = pgTable(
  'user_projects',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [unique('user_projects_user_id_project_id_unique').on(table.userId, table.projectId)],
)

export const projectRelations = relations(projects, ({ many }) => ({
  environments: many(environments),
  flags: many(featureFlags),
  apiKeys: many(apiKeys),
  members: many(userProjects),
}))

export const environmentRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, { fields: [environments.projectId], references: [projects.id] }),
  flagEnvironments: many(flagEnvironments),
  overrides: many(flagOverrides),
  apiKeys: many(apiKeys),
}))

export const featureFlagRelations = relations(featureFlags, ({ one, many }) => ({
  project: one(projects, { fields: [featureFlags.projectId], references: [projects.id] }),
  environments: many(flagEnvironments),
  overrides: many(flagOverrides),
}))

export const flagEnvironmentsRelations = relations(flagEnvironments, ({ one }) => ({
  flag: one(featureFlags, { fields: [flagEnvironments.flagId], references: [featureFlags.id] }),
  environment: one(environments, {
    fields: [flagEnvironments.environmentId],
    references: [environments.id],
  }),
}))

export const flagOverridesRelations = relations(flagOverrides, ({ one }) => ({
  flag: one(featureFlags, { fields: [flagOverrides.flagId], references: [featureFlags.id] }),
  environment: one(environments, {
    fields: [flagOverrides.environmentId],
    references: [environments.id],
  }),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
  environment: one(environments, {
    fields: [apiKeys.environmentId],
    references: [environments.id],
  }),
}))

export const userRelations = relations(users, ({ many }) => ({
  projects: many(userProjects),
}))

export const userProjectRelations = relations(userProjects, ({ one }) => ({
  user: one(users, { fields: [userProjects.userId], references: [users.id] }),
  project: one(projects, { fields: [userProjects.projectId], references: [projects.id] }),
}))

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Environment = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert
export type FeatureFlag = typeof featureFlags.$inferSelect
export type NewFeatureFlag = typeof featureFlags.$inferInsert
export type FlagEnvironment = typeof flagEnvironments.$inferSelect
export type NewFlagEnvironment = typeof flagEnvironments.$inferInsert
export type FlagOverride = typeof flagOverrides.$inferSelect
export type NewFlagOverride = typeof flagOverrides.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserProject = typeof userProjects.$inferSelect
