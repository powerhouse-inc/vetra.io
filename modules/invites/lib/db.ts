import { Pool } from 'pg'

// One connection pool reused across hot-reloads (dev) and route handlers
// (prod). Stashed on globalThis so Next.js module re-evaluation doesn't leak
// pools.
const globalForPg = globalThis as unknown as { invitePool?: Pool }

/**
 * Returns the shared Postgres pool, creating it on first use. Throws if
 * DATABASE_URL is not configured — invite endpoints can't run without it.
 */
export function getPool(): Pool {
  if (!globalForPg.invitePool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — required for invite-code endpoints')
    }
    globalForPg.invitePool = new Pool({ connectionString })
  }
  return globalForPg.invitePool
}
