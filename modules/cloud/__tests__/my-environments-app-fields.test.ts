import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchMyEnvironments, isUnknownFieldError } from '@/modules/cloud/graphql'

afterEach(() => vi.unstubAllGlobals())

describe('fetchMyEnvironments app fields', () => {
  it('detects schema mismatch errors', () => {
    expect(isUnknownFieldError(new Error('Cannot query field "appId" on type "X"'))).toBe(true)
    expect(isUnknownFieldError(new Error('GraphQL request failed: 500'))).toBe(false)
  })

  it('falls back to the base selection when the backend lacks appId', async () => {
    const bodies: string[] = []
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const body = init.body as string
      bodies.push(body)
      if (body.includes('appId')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ errors: [{ message: 'Cannot query field "appId" on type "Env".' }] }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: { myEnvironments: [{ id: 'e1' }] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const envs = await fetchMyEnvironments('MINE', 'tok')
    expect(envs).toEqual([{ id: 'e1' }])
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toContain('appId')
    expect(bodies[1]).not.toContain('appId')

    // Remembered: the next call goes straight to the base selection.
    await fetchMyEnvironments('MINE', 'tok')
    expect(bodies).toHaveLength(3)
    expect(bodies[2]).not.toContain('appId')
  })
})
