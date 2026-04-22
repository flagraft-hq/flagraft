import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from './schema.js'

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return Object.assign(db, { $pool: pool })
}

export type Db = ReturnType<typeof createDb>
