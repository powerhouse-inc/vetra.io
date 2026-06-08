import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from './schema'

// One Kysely instance (wrapping a single pg pool) reused across hot-reloads
// (dev) and route handlers (prod). Stashed on globalThis so Next.js module
// re-evaluation doesn't leak pools.
const globalForDb = globalThis as unknown as { inviteDb?: Kysely<DB> }

/**
 * Returns the shared Kysely database, creating it on first use. Throws if
 * DATABASE_URL is not configured — invite endpoints can't run without it.
 */
export function getDb(): Kysely<DB> {
  if (!globalForDb.inviteDb) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — required for invite-code endpoints')
    }
    globalForDb.inviteDb = new Kysely<DB>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
    })
  }
  return globalForDb.inviteDb
}
