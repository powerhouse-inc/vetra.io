#!/usr/bin/env node
// Invite-code management CLI. Codes are human-named cohort/channel codes
// (e.g. 'local-first', 'cohort-1'), handed out by hand. No admin UI by design.
//
// Usage (local — loads .env.local automatically via the pnpm script):
//   pnpm invite-codes <command> [args]
// Usage (prod — export DATABASE_URL yourself, then):
//   node scripts/invite-codes.mts <command> [args]
//
// Commands:
//   add <code> [--label="Local-First Conf"] [--expires=30d|2026-07-01] [--max-uses=200]
//   list                          list every code with its redemption count
//   redemptions [code]            who redeemed (optionally filtered to one code)
//   disable <code>                turn a code off (active=false)
//   enable  <code>                turn a code back on (active=true)
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import type { DB } from '../modules/invites/lib/schema.ts'

const USAGE = `invite-codes — manage invite codes

  add <code> [--label="..."] [--expires=30d|YYYY-MM-DD] [--max-uses=N]
  list
  redemptions [code]
  disable <code>
  enable  <code>`

type Flags = Record<string, string | boolean>

const normalizeCode = (code: string): string => code.trim().toLowerCase()

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// "30d" → 30 days from now; "2026-07-01" → that date; otherwise an error.
function parseExpiry(value: string): Date {
  const days = /^(\d+)d$/.exec(value)
  if (days) {
    const d = new Date()
    d.setDate(d.getDate() + Number(days[1]))
    return d
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    fail(`Invalid --expires value: "${value}" (use e.g. 30d or 2026-07-01)`)
  }
  return date
}

function parseFlags(args: string[]): { flags: Flags; positionals: string[] } {
  const flags: Flags = {}
  const positionals: string[] = []
  for (const arg of args) {
    const m = /^--([^=]+)=(.*)$/.exec(arg)
    if (m) flags[m[1]] = m[2]
    else if (arg.startsWith('--')) flags[arg.slice(2)] = true
    else positionals.push(arg)
  }
  return { flags, positionals }
}

const isoDate = (d: Date | null): string => (d ? d.toISOString() : 'never')

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE)
    return
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set. Run via `pnpm invite-codes …` (loads .env.local) or export it.')
  }

  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  })
  try {
    const { flags, positionals } = parseFlags(rest)

    switch (command) {
      case 'add': {
        const code = positionals[0] ? normalizeCode(positionals[0]) : undefined
        if (!code) fail('Usage: add <code> [--label="..."] [--expires=30d] [--max-uses=N]')
        const label = typeof flags.label === 'string' ? flags.label : null
        const expiresAt = typeof flags.expires === 'string' ? parseExpiry(flags.expires) : null
        const maxUses = typeof flags['max-uses'] === 'string' ? Number(flags['max-uses']) : null
        if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
          fail('--max-uses must be a positive integer')
        }

        const inserted = await db
          .insertInto('invite_codes')
          .values({ code, label, expires_at: expiresAt, max_uses: maxUses })
          .onConflict((oc) => oc.column('code').doNothing())
          .executeTakeFirst()
        if (Number(inserted.numInsertedOrUpdatedRows ?? 0) === 0) {
          fail(
            `Code "${code}" already exists. Use disable/enable to change it, or pick a new code.`,
          )
        }
        console.log(`✓ Added code "${code}"`)
        console.log(`    label:    ${label ?? '(none)'}`)
        console.log(`    expires:  ${isoDate(expiresAt)}`)
        console.log(`    max uses: ${maxUses ?? 'unlimited'}`)
        break
      }

      case 'list': {
        const rows = await db
          .selectFrom('invite_codes as c')
          .leftJoin('invite_redemptions as r', 'r.code', 'c.code')
          .select((eb) => [
            'c.code',
            'c.label',
            'c.active',
            'c.expires_at',
            'c.max_uses',
            sql<number>`count(${eb.ref('r.user_did')})::int`.as('redemptions'),
          ])
          .groupBy('c.code')
          .orderBy('c.created_at')
          .execute()
        if (rows.length === 0) {
          console.log('No codes yet. Add one with: pnpm invite-codes add <code>')
          break
        }
        console.table(
          rows.map((r) => ({
            code: r.code,
            label: r.label ?? '',
            active: r.active,
            expires: r.expires_at ? r.expires_at.toISOString().slice(0, 10) : 'never',
            max_uses: r.max_uses ?? '∞',
            redemptions: r.redemptions,
          })),
        )
        break
      }

      case 'redemptions': {
        const code = positionals[0] ? normalizeCode(positionals[0]) : undefined
        let query = db
          .selectFrom('invite_redemptions')
          .select(['code', 'user_did', 'redeemed_at', 'access_expires'])
          .orderBy('redeemed_at', 'desc')
        if (code) query = query.where('code', '=', code)
        const rows = await query.execute()
        if (rows.length === 0) {
          console.log(code ? `No redemptions for "${code}".` : 'No redemptions yet.')
          break
        }
        console.table(
          rows.map((r) => ({
            code: r.code,
            user_did: r.user_did,
            redeemed_at: r.redeemed_at.toISOString(),
            access_expires: isoDate(r.access_expires),
          })),
        )
        break
      }

      case 'disable':
      case 'enable': {
        const code = positionals[0] ? normalizeCode(positionals[0]) : undefined
        if (!code) fail(`Usage: ${command} <code>`)
        const active = command === 'enable'
        const updated = await db
          .updateTable('invite_codes')
          .set({ active })
          .where('code', '=', code)
          .executeTakeFirst()
        if (Number(updated.numUpdatedRows) === 0) fail(`No code named "${code}".`)
        console.log(`✓ ${active ? 'Enabled' : 'Disabled'} code "${code}"`)
        break
      }

      default:
        fail(`Unknown command "${command}".\n\n${USAGE}`)
    }
  } finally {
    await db.destroy()
  }
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
