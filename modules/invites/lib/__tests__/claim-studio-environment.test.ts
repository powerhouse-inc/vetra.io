import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimStudioEnvironment } from '../client'

describe('claimStudioEnvironment', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the claim result and sends the bearer token', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            VetraStudioPool: {
              claimStudioEnvironment: { documentId: 'd', subdomain: 's', tenantId: 't' },
            },
          },
        }),
        { status: 200 },
      ),
    )
    expect(await claimStudioEnvironment('tok')).toEqual({ documentId: 'd', subdomain: 's', tenantId: 't' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok')
  })

  it('returns null when the pool is empty', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { VetraStudioPool: { claimStudioEnvironment: null } } }), {
        status: 200,
      }),
    )
    expect(await claimStudioEnvironment('tok')).toBeNull()
  })

  it('returns null on transport failure', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    expect(await claimStudioEnvironment('tok')).toBeNull()
  })
})
