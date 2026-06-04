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
import pg from 'pg'

const USAGE = `invite-codes — manage invite codes

  add <code> [--label="..."] [--expires=30d|YYYY-MM-DD] [--max-uses=N]
  list
  redemptions [code]
  disable <code>
  enable  <code>`

interface CodeRow {
  code: string
  label: string | null
  active: boolean
  expires_at: Date | null
  max_uses: number | null
  redemptions: number
}

interface RedemptionRow {
  code: string
  user_did: string
  redeemed_at: Date
  access_expires: Date | null
}

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

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
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

        const { rowCount } = await pool.query(
          `insert into invite_codes (code, label, expires_at, max_uses)
             values ($1, $2, $3, $4)
             on conflict (code) do nothing`,
          [code, label, expiresAt, maxUses],
        )
        if (rowCount === 0) {
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
        const { rows } = await pool.query<CodeRow>(
          `select c.code, c.label, c.active, c.expires_at, c.max_uses,
                  count(r.user_did)::int as redemptions
             from invite_codes c
             left join invite_redemptions r on r.code = c.code
             group by c.code
             order by c.created_at`,
        )
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
        const { rows } = await pool.query<RedemptionRow>(
          `select code, user_did, redeemed_at, access_expires
             from invite_redemptions
             ${code ? 'where code = $1' : ''}
             order by redeemed_at desc`,
          code ? [code] : [],
        )
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
        const { rowCount } = await pool.query(
          `update invite_codes set active = $2 where code = $1`,
          [code, active],
        )
        if (rowCount === 0) fail(`No code named "${code}".`)
        console.log(`✓ ${active ? 'Enabled' : 'Disabled'} code "${code}"`)
        break
      }

      default:
        fail(`Unknown command "${command}".\n\n${USAGE}`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
