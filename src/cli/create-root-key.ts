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
      `DATABASE_URL is required before creating a root key. ${(error as Error).message}`
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
      type: 'admin',
      description: 'Root admin key'
    })

    console.log('Created root admin key. Save this - it will not be shown again:')
    console.log(`  ${key.plaintext}`)
  } catch (error) {
    const message = (error as Error).message
    if (message.includes('api_keys') || message.includes('relation')) {
      throw new Error('api_keys table does not exist. Run pnpm db:migrate first.')
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
