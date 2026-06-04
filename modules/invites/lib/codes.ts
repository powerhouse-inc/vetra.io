import { getPool } from './db'
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
  const { rowCount } = await getPool().query(
    `select 1 from invite_codes
       where code = $1 and active = true
         and (expires_at is null or expires_at > now())`,
    [normalizeCode(code)],
  )
  return (rowCount ?? 0) > 0
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
  const client = await getPool().connect()
  try {
    await client.query('begin')

    const usable = await client.query(
      `select 1 from invite_codes
         where code = $1 and active = true
           and (expires_at is null or expires_at > now())
         for update`,
      [normalized],
    )
    if ((usable.rowCount ?? 0) === 0) {
      await client.query('rollback')
      return { ok: false, reason: 'invalid_code' }
    }

    await client.query(
      `insert into invite_redemptions (code, user_did, access_expires)
         values ($1, $2, now() + make_interval(days => $3))
         on conflict (code, user_did) do nothing`,
      [normalized, did, ACCESS_DAYS],
    )

    await client.query('commit')
    return { ok: true }
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
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
  const { rows } = await getPool().query<{
    code: string
    label: string | null
    access_expires: Date | null
  }>(
    `select r.code, c.label, r.access_expires
       from invite_redemptions r
       join invite_codes c on c.code = r.code
       where r.user_did = $1
         and (r.access_expires is null or r.access_expires > now())
       order by r.redeemed_at desc
       limit 1`,
    [did],
  )

  if (rows.length === 0) return { allowed: false }
  const row = rows[0]
  return {
    allowed: true,
    code: row.code,
    label: row.label ?? undefined,
    accessExpires: row.access_expires?.toISOString(),
  }
}
