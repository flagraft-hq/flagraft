import { sql } from 'drizzle-orm'

import { createDb } from '../../src/db/index.js'

export function getTestDb() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for integration tests')
  }
  return createDb(url)
}

export async function truncateAll(db: ReturnType<typeof getTestDb>) {
  await db.execute(sql`
    TRUNCATE api_keys, flag_overrides, flag_environments, feature_flags, environments, projects
    RESTART IDENTITY CASCADE
  `)
}
