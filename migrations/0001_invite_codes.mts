// Invite codes — initial schema. Run with `pnpm migrate latest`.
// See modules/invites/README.md for what each table is for.
//
// Migrations are schema-version-agnostic, so they take `Kysely<any>` (the
// `DB` type describes the *current* schema, not historical ones) — the one
// place `any` is the right call. See the migrations/ override in
// eslint.config.mjs.
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Named, multi-use codes (one per channel/cohort, e.g. 'local-first').
  await db.schema
    .createTable('invite_codes')
    .ifNotExists()
    .addColumn('code', 'text', (col) => col.primaryKey()) // the code string itself
    .addColumn('label', 'text') // human-readable cohort/channel name
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true)) // kill switch
    .addColumn('expires_at', sql`timestamptz`) // code stops working after this (null = no window)
    .addColumn('max_uses', 'integer') // optional total-redemption cap (unused in v1)
    .addColumn('created_at', sql`timestamptz`, (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // One row per (code, user) — who came in through which code, and until when.
  await db.schema
    .createTable('invite_redemptions')
    .ifNotExists()
    .addColumn('code', 'text', (col) => col.notNull().references('invite_codes.code'))
    .addColumn('user_did', 'text', (col) => col.notNull()) // the Renown DID (did:pkh:eip155:...)
    .addColumn('redeemed_at', sql`timestamptz`, (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('access_expires', sql`timestamptz`) // per-user access expiry (redeemed_at + 30 days)
    // A given user redeems a given code at most once.
    .addPrimaryKeyConstraint('invite_redemptions_pkey', ['code', 'user_did'])
    .execute()

  // We look users up by DID alone (the composite PK only speeds up code+did lookups).
  await db.schema
    .createIndex('invite_redemptions_user_did_idx')
    .ifNotExists()
    .on('invite_redemptions')
    .column('user_did')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('invite_redemptions_user_did_idx').ifExists().execute()
  await db.schema.dropTable('invite_redemptions').ifExists().execute()
  await db.schema.dropTable('invite_codes').ifExists().execute()
}
