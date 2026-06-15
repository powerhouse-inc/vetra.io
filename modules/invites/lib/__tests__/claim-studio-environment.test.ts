import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { claimStudioEnvironment } from '../client'

describe('claimStudioEnvironment', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('returns the claim result and sends the bearer token', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          VetraStudioPool: {
            claimStudioEnvironment: { documentId: 'd', subdomain: 's', tenantId: 't' },
          },
        },
      }),
    })
    expect(await claimStudioEnvironment('tok')).toEqual({ documentId: 'd', subdomain: 's', tenantId: 't' })
    expect((fetch as any).mock.calls[0][1].headers['Authorization']).toBe('Bearer tok')
  })

  it('returns null when the pool is empty', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { VetraStudioPool: { claimStudioEnvironment: null } } }),
    })
    expect(await claimStudioEnvironment('tok')).toBeNull()
  })

  it('returns null on transport failure', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false })
    expect(await claimStudioEnvironment('tok')).toBeNull()
  })
})
