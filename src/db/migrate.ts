import path from 'node:path'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

/** Same path in the repo and in the image, so no configuration is needed. */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db/migrations')

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString })
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR })
  } finally {
    await pool.end()
  }
}

const entrypoint = process.argv[1]?.replace(/\\/g, '/')
if (
  entrypoint?.endsWith('/src/db/migrate.ts') ||
  entrypoint?.endsWith('/dist/db/migrate.js') ||
  entrypoint?.endsWith('/dist/db/migrate.cjs')
) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set') // eslint-disable-line no-console
    process.exit(1)
  }
  runMigrations(url)
    .then(() => console.log('Migrations applied.')) // eslint-disable-line no-console
    .catch((error: unknown) => {
      console.error(error) // eslint-disable-line no-console
      process.exit(1)
    })
}
