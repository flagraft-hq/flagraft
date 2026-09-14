import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from './schema.js'

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return Object.assign(db, { $pool: pool })
}

export type Db = ReturnType<typeof createDb>

/**
 * A pooled connection or an open transaction on one.
 *
 * Drizzle hands the transaction callback a `PgTransaction`, not the pool
 * wrapper `Db` describes, so anything meant to run either inside or outside a
 * transaction takes this instead.
 */
export type DbLike = Db | Parameters<Parameters<Db['transaction']>[0]>[0]
