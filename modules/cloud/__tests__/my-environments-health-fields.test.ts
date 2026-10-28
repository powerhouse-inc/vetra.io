import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchMyEnvironments } from '@/modules/cloud/graphql'

afterEach(() => vi.unstubAllGlobals())

describe('fetchMyEnvironments Argo health', () => {
  it('asks for argoHealthStatus/argoSyncStatus and drops only them on an older backend', async () => {
    const bodies: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        const body = init.body as string
        bodies.push(body)
        const answer = body.includes('argoHealthStatus')
          ? { errors: [{ message: 'Cannot query field "argoHealthStatus" on type "Env".' }] }
          : { data: { myEnvironments: [{ id: 'e1', appId: 'a1', ownerOrgId: null }] } }
        return Promise.resolve(
          new Response(JSON.stringify(answer), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    expect(await fetchMyEnvironments('MINE', 'tok')).toEqual([
      { id: 'e1', appId: 'a1', ownerOrgId: null },
    ])
    expect(bodies[0]).toContain('argoSyncStatus')
    expect(bodies).toHaveLength(2)
    // The other optional groups survive.
    expect(bodies[1]).toContain('appId')
    expect(bodies[1]).toContain('ownerOrgId')
    expect(bodies[1]).not.toContain('argoHealthStatus')

    await fetchMyEnvironments('MINE', 'tok')
    expect(bodies).toHaveLength(3)
    expect(bodies[2]).not.toContain('argoHealthStatus')
  })
})
