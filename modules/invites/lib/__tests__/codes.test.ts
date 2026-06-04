import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPool } from '@/modules/invites/lib/db'
import { getAccessStatus, isCodeUsable, redeemCode } from '@/modules/invites/lib/codes'
import { ACCESS_DAYS } from '@/modules/invites/lib/constants'

vi.mock('@/modules/invites/lib/db', () => ({ getPool: vi.fn() }))

const poolQuery = vi.fn<(text: string, params?: unknown[]) => Promise<unknown>>()
const clientQuery = vi.fn<(text: string, params?: unknown[]) => Promise<unknown>>()
const release = vi.fn()

beforeEach(() => {
  poolQuery.mockReset()
  clientQuery.mockReset()
  release.mockReset()
  vi.mocked(getPool).mockReturnValue({
    query: poolQuery,
    connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
  } as never)
})

describe('isCodeUsable', () => {
  it('normalizes the code to trimmed lowercase before querying', async () => {
    poolQuery.mockResolvedValue({ rowCount: 1 })
    expect(await isCodeUsable('  LOCAL-First  ')).toBe(true)
    expect(poolQuery.mock.calls[0][1]).toEqual(['local-first'])
  })

  it('returns false when no row matches', async () => {
    poolQuery.mockResolvedValue({ rowCount: 0 })
    expect(await isCodeUsable('nope')).toBe(false)
  })
})

describe('getAccessStatus', () => {
  it('maps the latest valid redemption', async () => {
    poolQuery.mockResolvedValue({
      rows: [
        {
          code: 'local-first',
          label: 'Local-First',
          access_expires: new Date('2030-01-01T00:00:00Z'),
        },
      ],
    })
    expect(await getAccessStatus('did:pkh:eip155:1:0xabc')).toEqual({
      allowed: true,
      code: 'local-first',
      label: 'Local-First',
      accessExpires: '2030-01-01T00:00:00.000Z',
    })
  })

  it('returns allowed:false when there is no redemption', async () => {
    poolQuery.mockResolvedValue({ rows: [] })
    expect(await getAccessStatus('did:pkh:eip155:1:0xabc')).toEqual({ allowed: false })
  })
})

describe('redeemCode', () => {
  it('commits and binds the normalized code + did + access window', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // begin
      .mockResolvedValueOnce({ rowCount: 1 }) // select … for update (usable)
      .mockResolvedValueOnce({ rowCount: 1 }) // insert
      .mockResolvedValueOnce({}) // commit

    expect(await redeemCode('LOCAL-FIRST', 'did:pkh:eip155:1:0xabc')).toEqual({ ok: true })

    const verbs = clientQuery.mock.calls.map((c) => c[0].trim().split(/\s+/)[0].toLowerCase())
    expect(verbs).toEqual(['begin', 'select', 'insert', 'commit'])
    expect(clientQuery.mock.calls[2][1]).toEqual([
      'local-first',
      'did:pkh:eip155:1:0xabc',
      ACCESS_DAYS,
    ])
    expect(release).toHaveBeenCalled()
  })

  it('rolls back and reports invalid_code when the code is unusable', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // begin
      .mockResolvedValueOnce({ rowCount: 0 }) // select … for update (not usable)
      .mockResolvedValueOnce({}) // rollback

    expect(await redeemCode('expired', 'did:pkh:eip155:1:0xabc')).toEqual({
      ok: false,
      reason: 'invalid_code',
    })
    const verbs = clientQuery.mock.calls.map((c) => c[0].trim().split(/\s+/)[0].toLowerCase())
    expect(verbs).toEqual(['begin', 'select', 'rollback'])
    expect(release).toHaveBeenCalled()
  })
})
