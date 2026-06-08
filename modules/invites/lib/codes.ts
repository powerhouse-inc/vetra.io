import { sql } from 'kysely'
import { getDb } from './db'
import { ACCESS_DAYS } from './constants'

/** Codes are case-insensitive; we canonicalise to trimmed lowercase. */
function normalizeCode(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * True if the code exists and is currently usable: active, and either no expiry
 * window or one still in the future. Validate-only — never mutates.
 */
export async function isCodeUsable(code: string): Promise<boolean> {
  const row = await getDb()
    .selectFrom('invite_codes')
    .select('code')
    .where('code', '=', normalizeCode(code))
    .where('active', '=', true)
    .where((eb) =>
      eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', sql<Date>`now()`)]),
    )
    .executeTakeFirst()
  return row !== undefined
}

export interface RedeemResult {
  ok: boolean
  reason?: 'invalid_code'
}

/**
 * Records that `did` came in through `code`, granting ACCESS_DAYS of access.
 * Re-checks the code is usable inside a transaction, then upserts the redemption
 * (idempotent: redeeming the same code twice is a no-op success).
 */
export async function redeemCode(code: string, did: string): Promise<RedeemResult> {
  const normalized = normalizeCode(code)
  return getDb()
    .transaction()
    .execute<RedeemResult>(async (trx) => {
      const usable = await trx
        .selectFrom('invite_codes')
        .select('code')
        .where('code', '=', normalized)
        .where('active', '=', true)
        .where((eb) =>
          eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', sql<Date>`now()`)]),
        )
        .forUpdate()
        .executeTakeFirst()
      if (!usable) return { ok: false, reason: 'invalid_code' }

      await trx
        .insertInto('invite_redemptions')
        .values({
          code: normalized,
          user_did: did,
          access_expires: sql<Date>`now() + make_interval(days => ${ACCESS_DAYS})`,
        })
        .onConflict((oc) => oc.columns(['code', 'user_did']).doNothing())
        .execute()

      return { ok: true }
    })
}

export interface AccessStatus {
  allowed: boolean
  /** The code/cohort the user came in through, when allowed. */
  code?: string
  label?: string
  accessExpires?: string
}

/**
 * Whether `did` currently has access, and which code/cohort granted it.
 * Returns the most recent still-valid redemption.
 */
export async function getAccessStatus(did: string): Promise<AccessStatus> {
  const row = await getDb()
    .selectFrom('invite_redemptions as r')
    .innerJoin('invite_codes as c', 'c.code', 'r.code')
    .select(['r.code', 'c.label', 'r.access_expires'])
    .where('r.user_did', '=', did)
    .where((eb) =>
      eb.or([eb('r.access_expires', 'is', null), eb('r.access_expires', '>', sql<Date>`now()`)]),
    )
    .orderBy('r.redeemed_at', 'desc')
    .limit(1)
    .executeTakeFirst()

  if (!row) return { allowed: false }
  return {
    allowed: true,
    code: row.code,
    label: row.label ?? undefined,
    accessExpires: row.access_expires?.toISOString(),
  }
}
