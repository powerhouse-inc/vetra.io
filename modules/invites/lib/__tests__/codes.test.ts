import { describe, expect, it, vi } from 'vitest'
import {
  CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
} from 'kysely'
import { getDb } from '@/modules/invites/lib/db'
import { getAccessStatus, isCodeUsable, redeemCode } from '@/modules/invites/lib/codes'
import { ACCESS_DAYS } from '@/modules/invites/lib/constants'
import type { Database } from '@/modules/invites/lib/schema'

vi.mock('@/modules/invites/lib/db', () => ({ getDb: vi.fn() }))

// A fake Kysely driver that records every compiled query (SQL + params,
// including transaction control) and replays a queue of canned results. This
// lets the tests exercise the real query builder and assert on the SQL Kysely
// actually generates, rather than mocking the fluent API.
type Captured = { sql: string; parameters: readonly unknown[] }

function fakeDb(results: Array<QueryResult<unknown>>): {
  db: Kysely<Database>
  captured: Captured[]
} {
  const captured: Captured[] = []
  const queue = [...results]

  const connection: DatabaseConnection = {
    executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
      captured.push({ sql: compiled.sql, parameters: compiled.parameters })
      return Promise.resolve((queue.shift() ?? { rows: [] }) as QueryResult<R>)
    },
    // eslint-disable-next-line require-yield, @typescript-eslint/require-await
    async *streamQuery() {
      throw new Error('streaming not supported in tests')
    },
  }

  const noop = (): Promise<void> => Promise.resolve()
  // Transaction control statements run through the connection too, so they
  // show up in `captured` (begin/commit/rollback) the way the old test asserted.
  const driver: Driver = {
    init: noop,
    acquireConnection: () => Promise.resolve(connection),
    beginTransaction: (conn) => conn.executeQuery(CompiledQuery.raw('begin')).then(noop),
    commitTransaction: (conn) => conn.executeQuery(CompiledQuery.raw('commit')).then(noop),
    rollbackTransaction: (conn) => conn.executeQuery(CompiledQuery.raw('rollback')).then(noop),
    releaseConnection: noop,
    destroy: noop,
  }

  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (d) => new PostgresIntrospector(d),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  })

  return { db, captured }
}

const verbOf = (q: Captured): string => q.sql.trim().split(/\s+/)[0].toLowerCase()

describe('isCodeUsable', () => {
  it('normalizes the code to trimmed lowercase before querying', async () => {
    const { db, captured } = fakeDb([{ rows: [{ code: 'local-first' }] }])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await isCodeUsable('  LOCAL-First  ')).toBe(true)
    expect(captured[0].parameters).toContain('local-first')
  })

  it('returns false when no row matches', async () => {
    const { db } = fakeDb([{ rows: [] }])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await isCodeUsable('nope')).toBe(false)
  })
})

describe('getAccessStatus', () => {
  it('maps the latest valid redemption', async () => {
    const { db } = fakeDb([
      {
        rows: [
          {
            code: 'local-first',
            label: 'Local-First',
            access_expires: new Date('2030-01-01T00:00:00Z'),
          },
        ],
      },
    ])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await getAccessStatus('did:pkh:eip155:1:0xabc')).toEqual({
      allowed: true,
      code: 'local-first',
      label: 'Local-First',
      accessExpires: '2030-01-01T00:00:00.000Z',
    })
  })

  it('returns allowed:false when there is no redemption', async () => {
    const { db } = fakeDb([{ rows: [] }])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await getAccessStatus('did:pkh:eip155:1:0xabc')).toEqual({ allowed: false })
  })
})

describe('redeemCode', () => {
  it('commits and binds the normalized code + did + access window', async () => {
    const { db, captured } = fakeDb([
      { rows: [] }, // begin
      { rows: [{ code: 'local-first' }] }, // select … for update (usable)
      { rows: [] }, // insert
      { rows: [] }, // commit
    ])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await redeemCode('LOCAL-FIRST', 'did:pkh:eip155:1:0xabc')).toEqual({ ok: true })

    expect(captured.map(verbOf)).toEqual(['begin', 'select', 'insert', 'commit'])
    const insert = captured[2]
    expect(insert.parameters).toEqual(['local-first', 'did:pkh:eip155:1:0xabc', ACCESS_DAYS])
  })

  it('reports invalid_code without inserting when the code is unusable', async () => {
    const { db, captured } = fakeDb([
      { rows: [] }, // begin
      { rows: [] }, // select … for update (not usable)
      { rows: [] }, // commit (read-only tx — nothing was written)
    ])
    vi.mocked(getDb).mockReturnValue(db)

    expect(await redeemCode('expired', 'did:pkh:eip155:1:0xabc')).toEqual({
      ok: false,
      reason: 'invalid_code',
    })
    // No insert is issued — the redemption row is never written.
    expect(captured.map(verbOf)).toEqual(['begin', 'select', 'commit'])
    expect(captured.some((q) => verbOf(q) === 'insert')).toBe(false)
  })
})
