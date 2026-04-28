import { API_KEY_TYPES } from '../auth/constants.js'
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
    createdAt: createdAt(),
  },
  (table) => ({
    projectSlugUnique: unique('environments_project_id_slug_unique').on(
      table.projectId,
      table.slug,
    ),
  }),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    projectKeyUnique: unique('feature_flags_project_id_key_unique').on(table.projectId, table.key),
  }),
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
  (table) => ({
    flagEnvironmentUnique: unique('flag_environments_flag_id_environment_id_unique').on(
      table.flagId,
      table.environmentId,
    ),
  }),
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
  (table) => ({
    overrideUnique: unique('flag_overrides_tuple_unique').on(
      table.flagId,
      table.environmentId,
      table.contextKey,
      table.contextValue,
    ),
  }),
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
  (table) => ({
    typeCheck: check(
      'api_keys_type_check',
      sql`${table.type} IN (${API_KEY_TYPES.CLIENT}, ${API_KEY_TYPES.ADMIN})`,
    ),
  }),
)

export const projectRelations = relations(projects, ({ many }) => ({
  environments: many(environments),
  flags: many(featureFlags),
  apiKeys: many(apiKeys),
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
