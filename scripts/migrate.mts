#!/usr/bin/env node
// Kysely migration runner for the invite-code SQL schema (migrations/*.mts).
//
// Usage (local — loads .env.local automatically via the pnpm script):
//   pnpm migrate            # migrate to latest (default)
//   pnpm migrate latest
//   pnpm migrate up         # apply the next pending migration only
//   pnpm migrate down       # revert the most recent migration
// Usage (prod — export DATABASE_URL yourself, then):
//   node scripts/migrate.mts latest
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Kysely, PostgresDialect } from 'kysely'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import pg from 'pg'

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// pg connection failures surface as an AggregateError with an empty `message`
// (the detail lives in `code`), so fall back to code/name to avoid blank output.
function describe(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as NodeJS.ErrnoException).code
    return e.message || code || e.name
  }
  return String(e)
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'latest'
  if (!['latest', 'up', 'down'].includes(command)) {
    fail(`Unknown command "${command}". Use: latest | up | down`)
  }
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set. Run via `pnpm migrate …` (loads .env.local) or export it.')
  }

  const migrationFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations')
  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  })
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      // Import by file:// URL so absolute paths resolve on every platform.
      import: (file) => import(pathToFileURL(file).href),
    }),
  })

  try {
    const { error, results } =
      command === 'up'
        ? await migrator.migrateUp()
        : command === 'down'
          ? await migrator.migrateDown()
          : await migrator.migrateToLatest()

    for (const r of results ?? []) {
      if (r.status === 'Success') {
        console.log(`✓ ${r.direction === 'Up' ? 'applied' : 'reverted'} ${r.migrationName}`)
      } else if (r.status === 'Error') {
        console.error(`✗ failed ${r.migrationName}`)
      }
    }
    if (error) throw error instanceof Error ? error : new Error(describe(error))
    if (!results?.length) console.log('Already up to date.')
  } finally {
    await db.destroy()
  }
}

main().catch((err: unknown) => fail(describe(err)))
