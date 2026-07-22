import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

/**
 * Applies all pending database migrations, then exits. Run before the server
 * starts (see docker-entrypoint.sh) so a freshly pulled image brings its own
 * schema up to date without needing drizzle-kit or any host tooling. Safe to
 * run on every boot -- drizzle skips migrations already recorded in the DB.
 *
 * MIGRATIONS_DIR points at the folder holding the generated SQL and its meta/
 * journal. Defaults to the in-repo path for local runs; the Docker image sets
 * it to the copied-in folder.
 */
async function main() {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? './src/db/migrations'
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  try {
    await migrate(db, { migrationsFolder })
    console.log('Migrations applied.') // eslint-disable-line no-console
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error) // eslint-disable-line no-console
  process.exit(1)
})
