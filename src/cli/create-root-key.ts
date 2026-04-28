/**
 * CLI script to generate and store a root admin API key.
 *
 * This script initializes the database connection, generates a new secure API key,
 * and inserts it into the `apiKeys` table with admin privileges. The generated
 * plaintext key is printed to the console exactly once and should be stored securely.
 *
 * Pre-requisites:
 * - DATABASE_URL must be set in the environment.
 * - Database migrations must have been run (`pnpm db:migrate`).
 */
import { API_KEY_TYPES } from '../auth/constants.js'
import { apiKeys } from '../db/schema.js'
import { loadConfig } from '../config.js'
import { createDb } from '../db/index.js'
import { generateKey } from '../plugins/auth.js'

async function main() {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    throw new Error(
      `DATABASE_URL is required before creating a root key. ${(error as Error).message}`,
      { cause: error },
    )
  }

  const db = createDb(config.DATABASE_URL)
  try {
    const key = generateKey()
    await db.insert(apiKeys).values({
      projectId: null,
      environmentId: null,
      keyHash: key.hash,
      keyPrefix: key.prefix,
      type: API_KEY_TYPES.ADMIN,
      description: 'Root admin key',
    })

    console.log('Created root admin key. Save this - it will not be shown again:')
    console.log(`  ${key.plaintext}`)
  } catch (error) {
    const message = (error as Error).message
    if (message.includes('api_keys') || message.includes('relation')) {
      throw new Error('api_keys table does not exist. Run pnpm db:migrate first.', { cause: error })
    }

    throw error
  } finally {
    await db.$pool.end()
  }
}

void main().catch((error) => {
  console.error((error as Error).message)
  process.exit(1)
})
