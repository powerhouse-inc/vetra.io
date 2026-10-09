import { describe, expect, it, vi } from 'vitest'
import { fetchAppStats } from '../lib/app-stats/api'
import { formatStatValue } from '../lib/app-stats/format'

const answer = (body: unknown, status = 200) =>
  vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status }))

describe('app stats reads', () => {
  it('asks Renown for an app’s public stats', async () => {
    const stats = {
      appDid: 'did:key:z1',
      activeUsers30d: 1,
      totalUsers: 2,
      updatedAt: null,
      metrics: [],
    }
    const fetchImpl = answer({ data: { appStats: stats } })
    expect(await fetchAppStats('did:key:z1', fetchImpl as unknown as typeof fetch)).toEqual(stats)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('https://switchboard.renown.vetra.io/graphql/renown-stats')
    const body = JSON.parse(init.body as string) as { query: string; variables: unknown }
    expect(body.query).toContain('appStats(appDid: $appDid)')
    expect(body.variables).toEqual({ appDid: 'did:key:z1' })
  })

  it('is null for an app Renown does not know, and throws Renown’s message', async () => {
    expect(
      await fetchAppStats(
        'did:key:z1',
        answer({ data: { appStats: null } }) as unknown as typeof fetch,
      ),
    ).toBeNull()
    await expect(
      fetchAppStats(
        'x',
        answer({
          errors: [{ message: 'appDid must be a did:key DID' }],
        }) as unknown as typeof fetch,
      ),
    ).rejects.toThrow('appDid must be a did:key DID')
    await expect(fetchAppStats('x', answer({}, 502) as unknown as typeof fetch)).rejects.toThrow(
      'Renown answered 502',
    )
  })

  it('formats values like renown.id', () => {
    expect(formatStatValue(1234)).toBe('1,234')
    expect(formatStatValue(12500)).toBe('12.5K')
    expect(formatStatValue(0.125)).toBe('0.13')
  })
})
