import type { ColumnType, Generated } from 'kysely'

// Kysely table types for the invite-code schema. See
// migrations/0001_invite_codes.sql for the source of truth.
//
// `Generated<T>` marks columns with a DB default (optional on insert).
// `ColumnType<Select, Insert, Update>` lets us write timestamps as SQL
// expressions on insert while reading them back as `Date`.

type Timestamp = ColumnType<Date, Date | string, Date | string>

export interface InviteCodesTable {
  code: string
  label: string | null
  active: Generated<boolean>
  expires_at: Timestamp | null
  max_uses: number | null
  created_at: Generated<Date>
}

export interface InviteRedemptionsTable {
  code: string
  user_did: string
  redeemed_at: Generated<Date>
  access_expires: Timestamp | null
}

export interface Database {
  invite_codes: InviteCodesTable
  invite_redemptions: InviteRedemptionsTable
}
