import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchMyEnvironments } from '@/modules/cloud/graphql'

afterEach(() => vi.unstubAllGlobals())

describe('fetchMyEnvironments ownerOrgId', () => {
  it('drops only ownerOrgId on a backend that knows the app fields but not organisations', async () => {
    const bodies: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        const body = init.body as string
        bodies.push(body)
        const answer = body.includes('ownerOrgId')
          ? { errors: [{ message: 'Cannot query field "ownerOrgId" on type "Env".' }] }
          : { data: { myEnvironments: [{ id: 'e1', appId: 'a1' }] } }
        return Promise.resolve(
          new Response(JSON.stringify(answer), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    expect(await fetchMyEnvironments('MINE', 'tok')).toEqual([{ id: 'e1', appId: 'a1' }])
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toContain('appId')
    expect(bodies[1]).not.toContain('ownerOrgId')

    await fetchMyEnvironments('MINE', 'tok')
    expect(bodies).toHaveLength(3)
    expect(bodies[2]).toContain('appRole')
    expect(bodies[2]).not.toContain('ownerOrgId')
  })
})
